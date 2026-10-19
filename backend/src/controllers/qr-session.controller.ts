import { Context } from "hono";
import { getUniversalDb } from "../db";
import { AppEnv } from "../types";
import { resolveAuthorizedOrg } from "../middleware/auth.middleware";
import { generateSecureQrToken } from "../utils/id-generator";

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Hash a raw token string to SHA-256 hex.
 * Used for storing/comparing tokens so raw bearer values are never stored.
 */
async function sha256Hex(raw: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(raw));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Session expiry duration in milliseconds (30 minutes) */
const SESSION_EXPIRY_MS = 30 * 60 * 1000;

// ─── Controller ─────────────────────────────────────────────────────────────

export const qrSessionController = {
  /**
   * POST /api/qr/session
   *
   * Public endpoint. Takes a permanent QR token (raw, from URL), validates it
   * against both:
   *   a) the legacy plain `qr_token` column (backward compat with existing QRs)
   *   b) the new `perm_token_hash` column (hashed storage)
   *
   * On success:
   *   - Creates a new temporary session with a fresh cryptographic token
   *   - Expires in SESSION_EXPIRY_MS (30 min)
   *   - Returns the raw temporary token ONCE so the client can redirect
   *
   * Security:
   *   - Permanent token only validated, never echoed back
   *   - Temporary token is returned raw ONCE for redirect; hash stored in DB
   *   - Organization isolation enforced
   */
  async createSession(c: Context<AppEnv>) {
    try {
      const body = await c.req.json().catch(() => ({})) as any;
      const rawPermToken = body.permanentToken ? String(body.permanentToken).trim() : "";

      if (!rawPermToken) {
        return c.json({ success: false, message: "permanentToken is required" }, 400);
      }

      const db = getUniversalDb(c.env?.DB);

      // Try legacy plain token lookup first, then hashed
      const permHash = await sha256Hex(rawPermToken);

      const row = (await db
        .prepare(
          `SELECT
            u.id,
            u.display_id as displayId,
            u.name,
            u.email,
            u.user_type as userType,
            u.qr_token as qrToken,
            u.qr_token_status as qrTokenStatus,
            u.perm_token_hash as permTokenHash,
            u.perm_token_status as permTokenStatus,
            o.id as organizationId,
            o.short_code as shortCode,
            o.name as orgName
           FROM users u
           JOIN user_organizations uo ON u.id = uo.user_id
           JOIN organizations o ON uo.organization_id = o.id
           WHERE u.qr_token = ?
              OR u.perm_token_hash = ?`
        )
        .bind(rawPermToken, permHash)
        .get()) as any;

      if (!row) {
        return c.json(
          { success: false, message: "QR ordering link is invalid or does not exist." },
          404
        );
      }

      // Check revocation for both legacy and new token columns
      const legacyRevoked = row.qrTokenStatus && row.qrTokenStatus !== "active";
      const newRevoked = row.permTokenStatus && row.permTokenStatus !== "active";
      if (legacyRevoked || newRevoked) {
        return c.json(
          {
            success: false,
            message:
              "This QR ordering link has been revoked. Please ask your administrator for a new QR code.",
          },
          403
        );
      }

      // Generate cryptographically secure temporary token
      const rawTempToken = generateSecureQrToken(24); // 24 chars = ~143 bits of entropy
      const tempHash = await sha256Hex(rawTempToken);

      const now = new Date();
      const expiresAt = new Date(now.getTime() + SESSION_EXPIRY_MS);
      const sessionId = `sess_${Date.now()}_${generateSecureQrToken(8)}`;

      // Lookup any assigned seat for this employee in this organization
      let assignedSeat: any = null;
      try {
        assignedSeat = await db
          .prepare(
            `SELECT s.id as seatId, s.number as seatNumber, s.location_id as locationId, l.name as locationName
             FROM seats s
             JOIN locations l ON s.location_id = l.id
             WHERE s.organization_id = ?
               AND (s.employee_id = ? OR LOWER(s.employee_email) = LOWER(?) OR LOWER(s.employee) = LOWER(?))
             LIMIT 1`
          )
          .bind(row.organizationId, row.id, row.email, row.email)
          .get();
      } catch {}

      await db
        .prepare(
          `INSERT INTO ordering_sessions
             (id, temp_token_hash, employee_id, organization_id, created_at, expires_at, status, seat_id, seat_number, location_id, location_name)
           VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)`
        )
        .bind(
          sessionId,
          tempHash,
          String(row.id),
          String(row.organizationId),
          now.toISOString(),
          expiresAt.toISOString(),
          assignedSeat?.seatId || null,
          assignedSeat?.seatNumber || null,
          assignedSeat?.locationId || null,
          assignedSeat?.locationName || null
        )
        .run();

      // Return the raw temp token ONCE — client must redirect immediately
      // Do NOT log this token
      return c.json(
        {
          success: true,
          tempToken: rawTempToken,
          expiresAt: expiresAt.toISOString(),
          shortCode: row.shortCode,
        },
        201
      );
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  /**
   * POST /api/qr/seat-session
   *
   * Public endpoint. Takes { shortCode, locationId, seatNumber, seatId } from the old raw ordering URL
   * or a seat-level QR code.
   *
   * Security & Business logic:
   *   1. Resolves organization via shortCode (defaults to 'FTS' if unspecified).
   *   2. Resolves location via locationId (verifies location belongs to the organization).
   *   3. Resolves seat via seatNumber or seatId (within that specific location & organization).
   *      - Query parameters like `?seatId=` are NEVER trusted as authorization credentials.
   *   4. If the seat has an assigned employee:
   *      - Resolves employee record in database.
   *      - Ensures employee belongs to the organization.
   *      - Verifies employee QR credential is active.
   *      - Issues a temporary ordering session bound to both employee and seat context.
   *   5. If the seat is unassigned:
   *      - cafe4x business rule: creates an authorized seat-level temporary session (or binds to seat guest)
   *        strictly bound to the verified location and seat.
   *   6. Returns { success: true, tempToken, shortCode, seat, employee } so frontend redirects to /:shortCode/qrorder/:tempToken.
   */
  async createSeatSession(c: Context<AppEnv>) {
    try {
      const body = await c.req.json().catch(() => ({})) as any;
      const rawShortCode = (body.shortCode || "").toString().trim().toUpperCase();
      const rawLocationId = (body.locationId || "").toString().trim();
      const rawSeatNumber = (body.seatNumber || "").toString().trim();
      const rawSeatId = (body.seatId || "").toString().trim();

      if (!rawLocationId || (!rawSeatNumber && !rawSeatId)) {
        return c.json(
          { success: false, message: "locationId and seatNumber are required to create an ordering session." },
          400
        );
      }

      const db = getUniversalDb(c.env?.DB);

      // 1. Resolve Organization
      let orgRow: any = null;
      if (rawShortCode) {
        orgRow = await db
          .prepare(`SELECT id, name, short_code as shortCode FROM organizations WHERE UPPER(short_code) = ?`)
          .bind(rawShortCode)
          .get();
      }

      // If shortCode was not supplied or not found, try finding via locationId
      if (!orgRow) {
        const locOrg = await db
          .prepare(
            `SELECT o.id, o.name, o.short_code as shortCode
             FROM locations l
             JOIN organizations o ON l.organization_id = o.id
             WHERE l.id = ? OR l.display_id = ?`
          )
          .bind(rawLocationId, rawLocationId)
          .get() as any;

        if (locOrg) {
          orgRow = locOrg;
        }
      }

      // Fallback default organization (FTS) if still unresolved
      if (!orgRow) {
        orgRow = await db
          .prepare(`SELECT id, name, short_code as shortCode FROM organizations WHERE UPPER(short_code) = 'FTS' LIMIT 1`)
          .get();
      }

      if (!orgRow) {
        return c.json({ success: false, message: "Organization could not be determined." }, 404);
      }

      // 2. Validate Location belongs to Organization
      const locRow = await db
        .prepare(
          `SELECT id, name, status, total_seats as totalSeats
           FROM locations
           WHERE (id = ? OR display_id = ? OR LOWER(name) = LOWER(?))
             AND organization_id = ?`
        )
        .bind(rawLocationId, rawLocationId, rawLocationId, orgRow.id)
        .get() as any;

      if (!locRow) {
        return c.json({ success: false, message: "Specified location was not found in this organization." }, 404);
      }

      if (locRow.status === "Inactive") {
        return c.json({ success: false, message: "This location is currently inactive." }, 403);
      }

      // 3. Resolve and Validate Seat
      // Normalize seat number representation (e.g. "1" -> "01")
      const parsedSeatNum = parseInt(rawSeatNumber, 10);
      const paddedSeatNum = !isNaN(parsedSeatNum) ? String(parsedSeatNum).padStart(2, "0") : rawSeatNumber;

      let seatRow = await db
        .prepare(
          `SELECT id, display_id as displayId, location_id as locationId, organization_id as organizationId,
                  number, employee, employee_name as employeeName, employee_email as employeeEmail, employee_id as employeeId
           FROM seats
           WHERE location_id = ?
             AND (number = ? OR number = ? OR id = ? OR display_id = ?)
           LIMIT 1`
        )
        .bind(locRow.id, rawSeatNumber, paddedSeatNum, rawSeatId || rawSeatNumber, rawSeatId || rawSeatNumber)
        .get() as any;

      // If seat not explicitly in seats table, check if it's within location's totalSeats
      if (!seatRow && !isNaN(parsedSeatNum) && parsedSeatNum >= 1 && parsedSeatNum <= (locRow.totalSeats || 12)) {
        // Automatically ensure seat record exists
        const generatedSeatId = `${orgRow.shortCode}-${paddedSeatNum}`;
        const generatedDisplayId = `SEAT-${orgRow.shortCode}-${paddedSeatNum}`;
        const nowIso = new Date().toISOString();
        try {
          await db
            .prepare(
              `INSERT INTO seats (id, display_id, location_id, organization_id, number, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(generatedSeatId, generatedDisplayId, locRow.id, orgRow.id, paddedSeatNum, nowIso, nowIso)
            .run();

          seatRow = {
            id: generatedSeatId,
            displayId: generatedDisplayId,
            locationId: locRow.id,
            organizationId: orgRow.id,
            number: paddedSeatNum,
            employee: null,
            employeeName: null,
            employeeEmail: null,
            employeeId: null,
          };
        } catch {
          // If already created concurrently, retrieve it
          seatRow = await db
            .prepare(`SELECT * FROM seats WHERE location_id = ? AND number = ?`)
            .bind(locRow.id, paddedSeatNum)
            .get();
        }
      }

      if (!seatRow) {
        return c.json({ success: false, message: "Requested seat does not exist in this location." }, 404);
      }

      // 4. Resolve Employee Assignment (if any)
      let assignedUser: any = null;
      const employeeIdentifier = seatRow.employeeEmail || seatRow.employee || "";
      const employeeId = seatRow.employeeId || "";

      if (employeeId || employeeIdentifier) {
        assignedUser = await db
          .prepare(
            `SELECT u.id, u.display_id as displayId, u.name, u.email, u.qr_token as qrToken,
                    u.qr_token_status as qrTokenStatus, u.perm_token_hash as permTokenHash,
                    u.perm_token_status as permTokenStatus
             FROM users u
             JOIN user_organizations uo ON u.id = uo.user_id
             WHERE uo.organization_id = ?
               AND (u.id = ? OR LOWER(u.email) = LOWER(?) OR LOWER(u.name) = LOWER(?))
             LIMIT 1`
          )
          .bind(orgRow.id, employeeId || employeeIdentifier, employeeIdentifier, employeeIdentifier)
          .get() as any;
      }

      // Check if employee's QR credentials were explicitly revoked
      if (assignedUser) {
        const legacyRevoked = assignedUser.qrTokenStatus && assignedUser.qrTokenStatus !== "active";
        const newRevoked = assignedUser.permTokenStatus && assignedUser.permTokenStatus !== "active";
        if (legacyRevoked || newRevoked) {
          return c.json(
            {
              success: false,
              message: "The QR ordering credential for the employee assigned to this seat has been revoked.",
            },
            403
          );
        }
      }

      // 5. Create Cryptographically Secure Temporary Ordering Session
      const rawTempToken = generateSecureQrToken(24);
      const tempHash = await sha256Hex(rawTempToken);
      const now = new Date();
      const expiresAt = new Date(now.getTime() + SESSION_EXPIRY_MS);
      const sessionId = `sess_${Date.now()}_${generateSecureQrToken(8)}`;

      // Bind session to assigned employee if one exists; otherwise store seat guest session
      // In ordering_sessions table, employee_id has an FK to users. If no assigned employee,
      // we check if an unassigned guest/seat ordering user exists, or bind employee_id to the location's assigned provider/admin
      // or set null if schema allows. To ensure absolute FK integrity across all D1 environments:
      let boundEmployeeId = assignedUser ? String(assignedUser.id) : null;

      if (!boundEmployeeId) {
        // Check if there is an organization default user or location provider
        const fallbackUser = await db
          .prepare(
            `SELECT u.id FROM users u
             JOIN user_organizations uo ON u.id = uo.user_id
             WHERE uo.organization_id = ?
             ORDER BY CASE WHEN u.user_type = 'Admin' THEN 1 ELSE 2 END
             LIMIT 1`
          )
          .bind(orgRow.id)
          .get() as any;

        // If ordering_sessions has NOT NULL on employee_id, we can safely associate with org admin/system user
        // while keeping seat_id and seat_number bound as guest context
        boundEmployeeId = fallbackUser ? String(fallbackUser.id) : null;
      }

      if (!boundEmployeeId) {
        return c.json({ success: false, message: "Unable to bind ordering session context." }, 500);
      }

      await db
        .prepare(
          `INSERT INTO ordering_sessions
             (id, temp_token_hash, employee_id, organization_id, created_at, expires_at, status, seat_id, seat_number, location_id, location_name)
           VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)`
        )
        .bind(
          sessionId,
          tempHash,
          boundEmployeeId,
          String(orgRow.id),
          now.toISOString(),
          expiresAt.toISOString(),
          seatRow.id || `${orgRow.shortCode}-${seatRow.number}`,
          seatRow.number,
          locRow.id,
          locRow.name
        )
        .run();

      return c.json(
        {
          success: true,
          tempToken: rawTempToken,
          expiresAt: expiresAt.toISOString(),
          shortCode: orgRow.shortCode,
          isAssignedEmployee: !!assignedUser,
          seat: {
            id: seatRow.id,
            number: seatRow.number,
            locationId: locRow.id,
            locationName: locRow.name,
            employeeName: assignedUser ? assignedUser.name : (seatRow.employeeName || null),
          },
        },
        201
      );
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  /**
   * Public endpoint. Validates a temporary ordering session token.
   * Returns employee and organization info if valid.
   * Used by UserOrderPage on mount to verify the session.
   *
   * Checks:
   *   - Token exists
   *   - Not expired (expires_at > now)
   *   - Not revoked (status = 'active')
   *   - Employee and organization still valid
   */
  async validateSession(c: Context<AppEnv>) {
    try {
      const rawToken = c.req.param("tempToken");
      if (!rawToken || !rawToken.trim()) {
        return c.json({ success: false, message: "Invalid session token" }, 400);
      }

      const db = getUniversalDb(c.env?.DB);
      const tokenHash = await sha256Hex(rawToken.trim());
      const now = new Date().toISOString();

      const row = (await db
        .prepare(
          `SELECT
            s.id as sessionId,
            s.status as sessionStatus,
            s.expires_at as expiresAt,
            s.created_at as createdAt,
            s.seat_id as seatId,
            s.seat_number as seatNumber,
            s.location_id as locationId,
            s.location_name as locationName,
            u.id as employeeId,
            u.display_id as displayId,
            u.name as employeeName,
            u.email as employeeEmail,
            u.user_type as userType,
            u.qr_token_status as qrTokenStatus,
            u.perm_token_status as permTokenStatus,
            o.id as organizationId,
            o.short_code as shortCode,
            o.name as orgName
           FROM ordering_sessions s
           LEFT JOIN users u ON s.employee_id = u.id
           JOIN organizations o ON s.organization_id = o.id
           WHERE s.temp_token_hash = ?`
        )
        .bind(tokenHash)
        .get()) as any;

      if (!row) {
        return c.json(
          { success: false, message: "Session not found. Please scan your QR code again." },
          404
        );
      }

      // Check revocation
      if (row.sessionStatus === "revoked") {
        return c.json(
          { success: false, message: "This ordering session has been revoked.", expired: false, revoked: true },
          403
        );
      }

      // Check expiry
      if (row.expiresAt < now) {
        // Mark session as expired (idempotent)
        await db
          .prepare(`UPDATE ordering_sessions SET status = 'expired' WHERE id = ?`)
          .bind(row.sessionId)
          .run();

        return c.json(
          {
            success: false,
            message: "Your ordering session has expired. Please scan your QR code again to start a new session.",
            expired: true,
            revoked: false,
            permanentTokenHint: null,
          },
          410
        );
      }

      // If session is bound to an employee, check that the employee's permanent credential is still active
      if (row.employeeId) {
        const legacyRevoked = row.qrTokenStatus && row.qrTokenStatus !== "active";
        const newRevoked = row.permTokenStatus && row.permTokenStatus !== "active";
        if (legacyRevoked || newRevoked) {
          return c.json(
            {
              success: false,
              message: "Employee QR credential has been revoked. Please ask your administrator for a new QR code.",
              expired: false,
              revoked: true,
            },
            403
          );
        }
      }

      return c.json({
        success: true,
        sessionId: row.sessionId,
        expiresAt: row.expiresAt,
        employee: row.employeeId
          ? {
              id: String(row.employeeId),
              displayId: row.displayId,
              name: row.employeeName,
              email: row.employeeEmail,
            }
          : null,
        seat: {
          id: row.seatId || null,
          number: row.seatNumber || null,
          locationId: row.locationId || null,
          locationName: row.locationName || null,
        },
        organization: {
          id: String(row.organizationId),
          shortCode: row.shortCode,
          name: row.orgName,
        },
      });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  /**
   * POST /api/qr/session/:sessionId/revoke  (Admin only)
   * Revokes an active ordering session.
   */
  async revokeSession(c: Context<AppEnv>) {
    try {
      const org = await resolveAuthorizedOrg(c);
      if (!org) {
        return c.json({ success: false, message: "Unauthorized" }, 403);
      }

      const sessionId = c.req.param("sessionId");
      const db = getUniversalDb(c.env?.DB);
      const now = new Date().toISOString();

      const res = await db
        .prepare(
          `UPDATE ordering_sessions
           SET status = 'revoked', revoked_at = ?
           WHERE id = ? AND organization_id = ?`
        )
        .bind(now, sessionId, org.organizationId)
        .run();

      if (res.changes === 0) {
        return c.json({ success: false, message: "Session not found" }, 404);
      }

      return c.json({ success: true, message: "Session revoked" });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  /**
   * POST /api/qr/provision/:userId  (Admin only)
   *
   * Provisions or re-provisions a permanent QR credential for a user.
   * Generates a new permanent token, hashes it, stores hash in DB.
   * Returns the raw token ONCE for QR code generation.
   * Also backfills the legacy qr_token column for backward compat.
   */
  async provisionPermanentToken(c: Context<AppEnv>) {
    try {
      const org = await resolveAuthorizedOrg(c);
      if (!org) {
        return c.json({ success: false, message: "Unauthorized" }, 403);
      }

      const userId = c.req.param("userId");
      const db = getUniversalDb(c.env?.DB);

      // Verify user belongs to this organization
      const link = (await db
        .prepare(
          `SELECT user_id as userId FROM user_organizations
           WHERE (user_id = ? OR user_id IN (SELECT id FROM users WHERE display_id = ?))
           AND organization_id = ?`
        )
        .bind(userId, userId, org.organizationId)
        .get()) as any;

      if (!link) {
        return c.json({ success: false, message: "User not found in this organization" }, 404);
      }

      const targetUserId = link.userId;
      const rawPermToken = generateSecureQrToken(20); // 20 chars for permanent token
      const permHash = await sha256Hex(rawPermToken);
      const now = new Date().toISOString();

      // Update both new hash column and legacy plain column (for backward compat with existing UI)
      await db
        .prepare(
          `UPDATE users
           SET perm_token_hash = ?,
               perm_token_created_at = ?,
               perm_token_status = 'active',
               qr_token = ?,
               qr_token_created_at = ?,
               qr_token_status = 'active'
           WHERE id = ?`
        )
        .bind(permHash, now, rawPermToken, now, targetUserId)
        .run();

      const userRow = (await db
        .prepare(
          `SELECT id, display_id as displayId, name, email,
                  perm_token_status as permTokenStatus
           FROM users WHERE id = ?`
        )
        .bind(targetUserId)
        .get()) as any;

      // Return raw permanent token ONCE for QR generation
      return c.json({
        success: true,
        message: "Permanent QR credential provisioned successfully",
        permanentToken: rawPermToken,   // raw token — use to build QR URL, then discard
        permTokenStatus: "active",
        user: userRow,
      }, 201);
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  /**
   * POST /api/qr/revoke/:userId  (Admin only)
   * Revokes the permanent QR credential for a user.
   * Existing active sessions are NOT auto-revoked (they expire naturally).
   */
  async revokePermanentToken(c: Context<AppEnv>) {
    try {
      const org = await resolveAuthorizedOrg(c);
      if (!org) {
        return c.json({ success: false, message: "Unauthorized" }, 403);
      }

      const userId = c.req.param("userId");
      const db = getUniversalDb(c.env?.DB);

      const link = (await db
        .prepare(
          `SELECT user_id as userId FROM user_organizations
           WHERE (user_id = ? OR user_id IN (SELECT id FROM users WHERE display_id = ?))
           AND organization_id = ?`
        )
        .bind(userId, userId, org.organizationId)
        .get()) as any;

      if (!link) {
        return c.json({ success: false, message: "User not found in this organization" }, 404);
      }

      const targetUserId = link.userId;

      await db
        .prepare(
          `UPDATE users
           SET perm_token_status = 'revoked',
               qr_token_status = 'revoked'
           WHERE id = ?`
        )
        .bind(targetUserId)
        .run();

      return c.json({ success: true, message: "Permanent QR credential revoked" });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  /**
   * GET /api/qr/sessions  (Admin only)
   * Returns recent ordering sessions for the organization (last 24h).
   */
  async listSessions(c: Context<AppEnv>) {
    try {
      const org = await resolveAuthorizedOrg(c);
      if (!org) {
        return c.json({ success: false, message: "Unauthorized" }, 403);
      }

      const db = getUniversalDb(c.env?.DB);
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const rows = (await db
        .prepare(
          `SELECT
            s.id as sessionId,
            s.status as sessionStatus,
            s.created_at as createdAt,
            s.expires_at as expiresAt,
            s.revoked_at as revokedAt,
            u.id as employeeId,
            u.name as employeeName,
            u.email as employeeEmail
           FROM ordering_sessions s
           JOIN users u ON s.employee_id = u.id
           WHERE s.organization_id = ? AND s.created_at >= ?
           ORDER BY s.created_at DESC
           LIMIT 200`
        )
        .bind(org.organizationId, since)
        .all()) as any[];

      return c.json({ success: true, sessions: rows || [] });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },
};
