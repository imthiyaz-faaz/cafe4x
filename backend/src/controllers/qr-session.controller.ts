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

      await db
        .prepare(
          `INSERT INTO ordering_sessions
             (id, temp_token_hash, employee_id, organization_id, created_at, expires_at, status)
           VALUES (?, ?, ?, ?, ?, ?, 'active')`
        )
        .bind(
          sessionId,
          tempHash,
          String(row.id),
          String(row.organizationId),
          now.toISOString(),
          expiresAt.toISOString()
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
   * GET /api/qr/validate/:tempToken
   *
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
           JOIN users u ON s.employee_id = u.id
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

      // Check that the employee's permanent credential is still active
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

      return c.json({
        success: true,
        sessionId: row.sessionId,
        expiresAt: row.expiresAt,
        employee: {
          id: String(row.employeeId),
          displayId: row.displayId,
          name: row.employeeName,
          email: row.employeeEmail,
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
