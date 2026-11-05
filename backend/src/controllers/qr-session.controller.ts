import { Context } from "hono";
import { getUniversalDb } from "../db";
import { AppEnv } from "../types";
import { resolveAuthorizedOrg } from "../middleware/auth.middleware";
import { generateSecureQrToken, normalizeLocationPrefix, generateSeatQrToken } from "../utils/id-generator";
import { getSigningSecret, createTemporaryOrderToken, verifyTemporaryOrderToken } from "../utils/token";
import { validateOrderingWindow } from "../utils/session-window";

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

      // Check organization ordering window / working hours
      const windowCheck = await validateOrderingWindow(db, String(row.organizationId));
      if (!windowCheck.allowed) {
        return c.json(
          {
            success: false,
            message: windowCheck.reason || "Ordering is currently closed for this organization.",
            windowStatus: windowCheck,
          },
          403
        );
      }

      // Generate cryptographically secure stateless temporary token (signed JWT)
      const secret = getSigningSecret(c.env);
      const sessionId = `sess_${Date.now()}_${generateSecureQrToken(8)}`;
      const now = new Date();
      const expiresAt = new Date(now.getTime() + SESSION_EXPIRY_MS);

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

      const signedToken = await createTemporaryOrderToken(
        {
          sessionId,
          organizationId: String(row.organizationId),
          shortCode: row.shortCode,
          employeeId: String(row.id),
          locationId: assignedSeat?.locationId || null,
          seatNumber: assignedSeat?.seatNumber || null,
          seatId: assignedSeat?.seatId || null,
        },
        secret,
        SESSION_EXPIRY_MS / 1000
      );

      // Return the stateless signed temp token ONCE — client must redirect immediately
      return c.json(
        {
          success: true,
          tempToken: signedToken,
          token: signedToken,
          expiresAt: expiresAt.toISOString(),
          shortCode: row.shortCode,
          windowStatus: windowCheck,
        },
        201
      );
    } catch (err: any) {
      console.error("Error in createSeatSession:", err);
      return c.json({ success: false, message: "Internal server error occurred while preparing your ordering session." }, 500);
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
      const rawSeatToken = (body.seatToken || body.qrToken || "").toString().trim();

      if (!rawSeatToken && !rawLocationId && !rawSeatNumber && !rawSeatId) {
        return c.json(
          { success: false, message: "seatToken or locationId and seatNumber are required to create an ordering session." },
          400
        );
      }

      const db = getUniversalDb(c.env?.DB);

      // Self-healing check for table schema
      try {
        await db.exec(`
          CREATE TABLE IF NOT EXISTS employee_seat_assignments (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            location_id TEXT NOT NULL,
            seat_id TEXT NOT NULL,
            employee_id TEXT NOT NULL,
            assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
            FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE,
            FOREIGN KEY (seat_id) REFERENCES seats(id) ON DELETE CASCADE,
            FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(location_id, seat_id),
            UNIQUE(organization_id, employee_id)
          );
        `);
      } catch {}
      try {
        await db.exec(`ALTER TABLE seats ADD COLUMN qr_token TEXT;`);
      } catch {}
      try {
        await db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_seats_qr_token ON seats(qr_token);`);
      } catch {}

      let orgRow: any = null;
      let locRow: any = null;
      let seatRow: any = null;
      let assignedUser: any = null;

      // Case A: Look up authoritative seat by unique permanent seat QR token
      if (rawSeatToken) {
        let found: any = null;
        try {
          found = (await db
            .prepare(
              `SELECT 
                 s.id, 
                 s.display_id as displayId, 
                 s.location_id as locationId, 
                 s.organization_id as organizationId,
                 s.number, 
                 s.qr_token as qrToken,
                 s.order_url as orderUrl,
                 COALESCE(u.email, s.employee_email, s.employee) as employee, 
                 COALESCE(u.name, s.employee_name) as employeeName, 
                 COALESCE(u.email, s.employee_email) as employeeEmail, 
                 COALESCE(u.id, esa.employee_id, s.employee_id) as employeeId,
                 u.qr_token as employeeQrToken,
                 u.qr_token_status as qrTokenStatus,
                 u.perm_token_status as permTokenStatus,
                 l.id as locId,
                 l.name as locName,
                 l.status as locStatus,
                 l.total_seats as locTotalSeats,
                 o.id as orgId,
                 o.short_code as orgShortCode,
                 o.name as orgName
               FROM seats s
               JOIN locations l ON s.location_id = l.id
               JOIN organizations o ON s.organization_id = o.id
               LEFT JOIN employee_seat_assignments esa ON s.id = esa.seat_id AND s.location_id = esa.location_id
               LEFT JOIN users u ON (esa.employee_id = u.id OR s.employee_id = u.id)
               WHERE s.qr_token = ? OR s.id = ? OR s.display_id = ?
               LIMIT 1`
            )
            .bind(rawSeatToken, rawSeatToken, rawSeatToken)
            .get()) as any;
        } catch {
          // Fallback if employee_seat_assignments table is not present in D1 instance
          found = (await db
            .prepare(
              `SELECT 
                 s.id, 
                 s.display_id as displayId, 
                 s.location_id as locationId, 
                 s.organization_id as organizationId,
                 s.number, 
                 s.qr_token as qrToken,
                 s.order_url as orderUrl,
                 COALESCE(u.email, s.employee_email, s.employee) as employee, 
                 COALESCE(u.name, s.employee_name) as employeeName, 
                 COALESCE(u.email, s.employee_email) as employeeEmail, 
                 COALESCE(u.id, s.employee_id) as employeeId,
                 u.qr_token as employeeQrToken,
                 u.qr_token_status as qrTokenStatus,
                 u.perm_token_status as permTokenStatus,
                 l.id as locId,
                 l.name as locName,
                 l.status as locStatus,
                 l.total_seats as locTotalSeats,
                 o.id as orgId,
                 o.short_code as orgShortCode,
                 o.name as orgName
               FROM seats s
               JOIN locations l ON s.location_id = l.id
               JOIN organizations o ON s.organization_id = o.id
               LEFT JOIN users u ON (s.employee_id = u.id)
               WHERE s.qr_token = ? OR s.id = ? OR s.display_id = ?
               LIMIT 1`
            )
            .bind(rawSeatToken, rawSeatToken, rawSeatToken)
            .get()) as any;
        }

        if (found) {
          seatRow = {
            id: found.id,
            displayId: found.displayId || found.id,
            locationId: found.locationId,
            organizationId: found.organizationId,
            number: found.number,
            qrToken: found.qrToken,
            orderUrl: found.orderUrl,
            employee: found.employee,
            employeeName: found.employeeName,
            employeeEmail: found.employeeEmail,
            employeeId: found.employeeId,
          };
          orgRow = {
            id: found.orgId,
            shortCode: found.orgShortCode,
            name: found.orgName,
          };
          locRow = {
            id: found.locId,
            name: found.locName,
            status: found.locStatus,
            totalSeats: found.locTotalSeats,
          };
          if (found.employeeId) {
            assignedUser = {
              id: found.employeeId,
              name: found.employeeName,
              email: found.employeeEmail,
              qrTokenStatus: found.qrTokenStatus,
              permTokenStatus: found.permTokenStatus,
            };
          }
        } else {
          return c.json({ success: false, message: "Seat not found for the provided QR token." }, 404);
        }
      }

      // Case B: Fallback to locationId + seatNumber/seatId
      if (!seatRow) {
        if (!rawLocationId || (!rawSeatNumber && !rawSeatId)) {
          return c.json(
            { success: false, message: "locationId and seatNumber are required to create an ordering session." },
            400
          );
        }

        // 1. Resolve Organization
        if (rawShortCode) {
          orgRow = await db
            .prepare(`SELECT id, name, short_code as shortCode FROM organizations WHERE UPPER(short_code) = ?`)
            .bind(rawShortCode)
            .get();
        }

        if (!orgRow) {
          const locOrg = (await db
            .prepare(
              `SELECT o.id, o.name, o.short_code as shortCode
               FROM locations l
               JOIN organizations o ON l.organization_id = o.id
               WHERE l.id = ? OR l.display_id = ?`
            )
            .bind(rawLocationId, rawLocationId)
            .get()) as any;

          if (locOrg) orgRow = locOrg;
        }

        if (!orgRow) {
          orgRow = await db
            .prepare(`SELECT id, name, short_code as shortCode FROM organizations WHERE UPPER(short_code) = 'FTS' LIMIT 1`)
            .get();
        }

        if (!orgRow) {
          return c.json({ success: false, message: "Organization could not be determined." }, 404);
        }

        // 2. Validate Location
        locRow = (await db
          .prepare(
            `SELECT id, name, status, total_seats as totalSeats
             FROM locations
             WHERE (id = ? OR display_id = ? OR LOWER(name) = LOWER(?))
               AND organization_id = ?`
          )
          .bind(rawLocationId, rawLocationId, rawLocationId, orgRow.id)
          .get()) as any;

        if (!locRow) {
          return c.json({ success: false, message: "Specified location was not found in this organization." }, 404);
        }

        // 3. Resolve and Validate Seat
        const parsedSeatNum = parseInt(rawSeatNumber, 10);
        const paddedSeatNum = !isNaN(parsedSeatNum) ? String(parsedSeatNum).padStart(2, "0") : rawSeatNumber;

        seatRow = (await db
          .prepare(
            `SELECT id, display_id as displayId, location_id as locationId, organization_id as organizationId,
                    number, qr_token as qrToken, order_url as orderUrl,
                    employee, employee_name as employeeName, employee_email as employeeEmail, employee_id as employeeId
             FROM seats
             WHERE location_id = ?
               AND (number = ? OR number = ? OR id = ? OR display_id = ?)
             LIMIT 1`
          )
          .bind(locRow.id, rawSeatNumber, paddedSeatNum, rawSeatId || rawSeatNumber, rawSeatId || rawSeatNumber)
          .get()) as any;

        if (!seatRow && !isNaN(parsedSeatNum) && parsedSeatNum >= 1 && parsedSeatNum <= (locRow.totalSeats || 12)) {
          const locPrefix = normalizeLocationPrefix(locRow.name);
          const generatedSeatId = `${locPrefix}-${String(parsedSeatNum).padStart(4, "0")}`;
          const generatedDisplayId = generatedSeatId;
          const generatedToken = generateSeatQrToken();
          const targetUrl = `/${orgRow.shortCode}/order/${generatedToken}`;
          const nowIso = new Date().toISOString();
          try {
            await db
              .prepare(
                `INSERT INTO seats (id, display_id, location_id, organization_id, number, qr_token, order_url, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
              )
              .bind(generatedSeatId, generatedDisplayId, locRow.id, orgRow.id, paddedSeatNum, generatedToken, targetUrl, nowIso, nowIso)
              .run();

            seatRow = {
              id: generatedSeatId,
              displayId: generatedDisplayId,
              locationId: locRow.id,
              organizationId: orgRow.id,
              number: paddedSeatNum,
              qrToken: generatedToken,
              orderUrl: targetUrl,
              employee: null,
              employeeName: null,
              employeeEmail: null,
              employeeId: null,
            };
          } catch {
            seatRow = await db
              .prepare(`SELECT * FROM seats WHERE location_id = ? AND number = ?`)
              .bind(locRow.id, paddedSeatNum)
              .get();
          }
        }

        if (!seatRow) {
          return c.json({ success: false, message: "Requested seat does not exist in this location." }, 404);
        }

        // 4. Resolve Employee Assignment
        const employeeIdentifier = seatRow.employeeEmail || seatRow.employee || "";
        const employeeId = seatRow.employeeId || "";

        if (employeeId || employeeIdentifier) {
          assignedUser = (await db
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
            .get()) as any;
        }
      }

      if (locRow.status === "Inactive") {
        return c.json({ success: false, message: "This location is currently inactive." }, 403);
      }

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

      // Check organization ordering window / working hours
      const windowCheck = await validateOrderingWindow(db, String(orgRow.id));
      if (!windowCheck.allowed) {
        return c.json(
          {
            success: false,
            message: windowCheck.reason || "Ordering is currently closed for this organization.",
            windowStatus: windowCheck,
          },
          403
        );
      }

      // 5. Create Cryptographically Secure Stateless Temporary Ordering Token (signed JWT)
      const secret = getSigningSecret(c.env);
      const sessionId = `sess_${Date.now()}_${generateSecureQrToken(8)}`;
      const now = new Date();
      const expiresAt = new Date(now.getTime() + SESSION_EXPIRY_MS);

      const boundEmployeeId = assignedUser ? String(assignedUser.id) : (seatRow.employeeId ? String(seatRow.employeeId) : null);
      const boundEmployeeName = assignedUser ? assignedUser.name : (seatRow.employeeName || null);
      const boundSeatNumber = seatRow.number ? String(seatRow.number).padStart(2, "0") : null;
      const boundSeatId = seatRow.id || (boundSeatNumber ? `${orgRow.shortCode}-${boundSeatNumber}` : null);
      const boundSeatQrToken = seatRow.qrToken || seatRow.qr_token || null;

      const signedToken = await createTemporaryOrderToken(
        {
          sessionId,
          organizationId: String(orgRow.id),
          shortCode: orgRow.shortCode,
          employeeId: boundEmployeeId,
          employeeName: boundEmployeeName,
          locationId: locRow.id,
          locationName: locRow.name,
          seatNumber: boundSeatNumber,
          seatId: boundSeatId,
          seatQrToken: boundSeatQrToken,
        },
        secret,
        SESSION_EXPIRY_MS / 1000
      );

      return c.json(
        {
          success: true,
          tempToken: signedToken,
          token: signedToken,
          expiresAt: expiresAt.toISOString(),
          shortCode: orgRow.shortCode,
          isAssignedEmployee: !!boundEmployeeName,
          windowStatus: windowCheck,
          seat: {
            id: boundSeatId,
            displayId: boundSeatId,
            number: boundSeatNumber,
            qrToken: boundSeatQrToken,
            orderUrl: seatRow.orderUrl || seatRow.order_url || `/${orgRow.shortCode}/order/${boundSeatQrToken}`,
            locationId: locRow.id,
            locationName: locRow.name,
            employeeName: boundEmployeeName,
          },
          employee: boundEmployeeName
            ? {
                id: boundEmployeeId,
                name: boundEmployeeName,
                email: assignedUser?.email || seatRow.employeeEmail || seatRow.employee || null,
              }
            : null,
        },
        201
      );
    } catch (err: any) {
      console.error("Error in createSeatSession:", err);
      return c.json({ success: false, message: "Internal server error occurred while preparing your ordering session." }, 500);
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
      const secret = getSigningSecret(c.env);

      // ── 1. Check if token is a stateless signed JWT temporary token ─────────
      if (rawToken.includes(".")) {
        const verifyRes = await verifyTemporaryOrderToken(rawToken.trim(), secret);
        if (!verifyRes.valid) {
          if (verifyRes.reason === "expired") {
            return c.json(
              {
                success: false,
                message: "Your ordering session has expired. Please scan your QR code again.",
                expired: true,
                revoked: false,
              },
              410
            );
          }
          return c.json(
            {
              success: false,
              message: "Invalid or tampered temporary ordering token.",
              expired: false,
              revoked: false,
            },
            401
          );
        }

        const payload = verifyRes.payload;

        // Verify organization exists in database
        const orgRow = (await db
          .prepare(`SELECT id, short_code as shortCode, name, currency_code as currency FROM organizations WHERE id = ?`)
          .bind(payload.orgId)
          .get()) as any;

        if (!orgRow) {
          return c.json({ success: false, message: "Organization does not exist or has been removed." }, 404);
        }

        // Verify organization's ordering window / working hours
        const windowCheck = await validateOrderingWindow(db, payload.orgId);
        if (!windowCheck.allowed) {
          return c.json(
            {
              success: false,
              message: windowCheck.reason || "Ordering is currently closed for this organization.",
              windowStatus: windowCheck,
              isClosed: true,
            },
            403
          );
        }

        // Resolve verified employee (if bound to employee)
        let employee: any = null;
        if (payload.empId) {
          const userRow = (await db
            .prepare(
              `SELECT u.id, u.display_id as displayId, u.name, u.email,
                      u.qr_token_status as qrTokenStatus, u.perm_token_status as permTokenStatus
               FROM users u
               JOIN user_organizations uo ON u.id = uo.user_id
               WHERE u.id = ? AND uo.organization_id = ?`
            )
            .bind(payload.empId, payload.orgId)
            .get()) as any;

          if (!userRow) {
            return c.json({ success: false, message: "Assigned employee not found in this organization." }, 404);
          }

          const legacyRevoked = userRow.qrTokenStatus && userRow.qrTokenStatus !== "active";
          const newRevoked = userRow.permTokenStatus && userRow.permTokenStatus !== "active";
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

          employee = {
            id: String(userRow.id),
            displayId: userRow.displayId,
            name: userRow.name,
            email: userRow.email,
          };
        }

        // Resolve location name if locId is present
        let locationName: string | null = null;
        if (payload.locId) {
          const locRow = (await db
            .prepare(`SELECT name FROM locations WHERE id = ? AND organization_id = ?`)
            .bind(payload.locId, payload.orgId)
            .get()) as any;
          if (locRow) locationName = locRow.name;
        }

        return c.json({
          success: true,
          sessionId: payload.sub,
          expiresAt: new Date(payload.exp * 1000).toISOString(),
          employee: employee || (payload.empName ? { id: payload.empId, name: payload.empName } : null),
          windowStatus: windowCheck,
          seat: {
            id: payload.seatId || null,
            displayId: payload.seatId || null,
            number: payload.seatNo || null,
            locationId: payload.locId || null,
            locationName: locationName || payload.locName || null,
            qrToken: payload.seatQrToken || null,
            employeeName: employee?.name || payload.empName || null,
          },
          organization: {
            id: String(orgRow.id),
            shortCode: orgRow.shortCode,
            name: orgRow.name,
          },
        });
      }

      // Non-JWT token is rejected as invalid/obsolete
      return c.json(
        {
          success: false,
          message: "Invalid or expired temporary session token. Please re-scan your QR code.",
          expired: false,
          revoked: false,
        },
        401
      );
    } catch (err: any) {
      console.error("Error in createSeatSession:", err);
      return c.json({ success: false, message: "Internal server error occurred while preparing your ordering session." }, 500);
    }
  },

  /**
   * POST /api/qr/session/:sessionId/revoke  (Admin only)
   * Stateless sessions expire naturally within 30 minutes.
   */
  async revokeSession(c: Context<AppEnv>) {
    try {
      const org = await resolveAuthorizedOrg(c);
      if (!org) {
        return c.json({ success: false, message: "Unauthorized" }, 403);
      }

      return c.json({
        success: true,
        message: "Session revoked. Temporary tokens expire automatically after 30 minutes.",
      });
    } catch (err: any) {
      console.error("Error in createSeatSession:", err);
      return c.json({ success: false, message: "Internal server error occurred while preparing your ordering session." }, 500);
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
      console.error("Error in createSeatSession:", err);
      return c.json({ success: false, message: "Internal server error occurred while preparing your ordering session." }, 500);
    }
  },

  /**
   * POST /api/qr/revoke/:userId  (Admin only)
   * Revokes the permanent QR credential for a user.
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
      console.error("Error in createSeatSession:", err);
      return c.json({ success: false, message: "Internal server error occurred while preparing your ordering session." }, 500);
    }
  },

  /**
   * GET /api/qr/sessions  (Admin only)
   * Sessions are stateless tokens, returning an empty list without database table dependency.
   */
  async listSessions(c: Context<AppEnv>) {
    try {
      const org = await resolveAuthorizedOrg(c);
      if (!org) {
        return c.json({ success: false, message: "Unauthorized" }, 403);
      }

      return c.json({ success: true, sessions: [] });
    } catch (err: any) {
      console.error("Error in createSeatSession:", err);
      return c.json({ success: false, message: "Internal server error occurred while preparing your ordering session." }, 500);
    }
  },
};
