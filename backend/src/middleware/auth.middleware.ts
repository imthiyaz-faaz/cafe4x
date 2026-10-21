import { Context, Next } from "hono";
import { AppEnv, AuthUser } from "../types";
import { getUniversalDb } from "../db";
import { sha256Hex } from "../utils/id-generator";

/**
 * Extracts the authenticated user from the Bearer token.
 * Validates the session against the user_sessions table:
 * - Checks that token exists and is valid
 * - Checks that the session has not expired
 * - Checks that the session has not been revoked
 * - Returns null if the token is invalid, expired, or missing
 */
export async function getAuthUser(c: Context<AppEnv>): Promise<AuthUser | null> {
  const authHeader = c.req.header("Authorization") || "";
  let rawToken: string | null = null;
  let parsedUserId: string | null = null;

  if (authHeader.startsWith("Bearer ")) {
    rawToken = authHeader.replace("Bearer ", "").trim();
    const parts = rawToken.split("_");
    if (parts.length >= 3) {
      parsedUserId = parts[2];
    }
  }

  // Reject requests without a Bearer token
  if (!rawToken) {
    return null;
  }

  try {
    const db = getUniversalDb(c.env?.DB);
    const nowIso = new Date().toISOString();
    const tokenHash = await sha256Hex(rawToken);

    // 1. Check user_sessions table for an active, unexpired, unrevoked session
    const existingSession = (await db
      .prepare(
        `SELECT s.id, s.user_id as userId, s.expires_at as expiresAt, s.revoked_at as revokedAt,
                u.id as uId, u.name, u.user_name as userName, u.email, u.user_type as userType
         FROM user_sessions s
         JOIN users u ON s.user_id = u.id
         WHERE s.token_hash = ?`
      )
      .bind(tokenHash)
      .get()) as any;

    if (existingSession) {
      // If the session was explicitly revoked or has expired, immediately deny access
      if (existingSession.revokedAt || existingSession.expiresAt <= nowIso) {
        return null;
      }

      return {
        id: String(existingSession.uId),
        name: existingSession.name,
        userName: existingSession.userName,
        email: existingSession.email,
        userType: existingSession.userType,
      };
    }

    // 2. Backward compatibility fallback for legacy active tokens not yet in user_sessions:
    // Only valid if this token was NOT previously recorded (or revoked) in user_sessions
    if (parsedUserId && rawToken.startsWith("cafe4x_token_")) {
      const parts = rawToken.split("_");
      const tokenTime = parseInt(parts[parts.length - 1], 10);
      const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
      if (!isNaN(tokenTime) && Date.now() - tokenTime < SEVEN_DAYS_MS) {
        const userRow = (await db
          .prepare(
            `SELECT id, name, user_name as userName, email, user_type as userType 
             FROM users WHERE id = ?`
          )
          .bind(parsedUserId)
          .get()) as any;

        if (userRow) {
          // Transparently register session in user_sessions for future requests
          try {
            const expiresAt = new Date(Date.now() + SEVEN_DAYS_MS).toISOString();
            const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
            await db
              .prepare(
                `INSERT OR IGNORE INTO user_sessions (id, token_hash, user_id, expires_at)
                 VALUES (?, ?, ?, ?)`
              )
              .run(sessionId, tokenHash, userRow.id, expiresAt);
          } catch {}

          return {
            id: String(userRow.id),
            name: userRow.name,
            userName: userRow.userName,
            email: userRow.email,
            userType: userRow.userType,
          };
        }
      }
    }

    return null;
  } catch (err) {
    console.warn("Error fetching auth user:", err);
    return null;
  }
}

/**
 * Middleware that requires a valid authenticated user session.
 * Rejects unauthenticated requests with 401 Unauthorized.
 */
export async function requireAuth(c: Context<AppEnv>, next: Next) {
  const user = await getAuthUser(c);
  if (!user) {
    return c.json({ success: false, message: "Authentication required. Please sign in." }, 401);
  }
  c.set("user", user);
  await next();
}

/**
 * Middleware that requires the user to have one of the specified roles (e.g. Admin, Provider).
 */
export function requireRole(...allowedRoles: string[]) {
  return async (c: Context<AppEnv>, next: Next) => {
    let user = c.get("user");
    if (!user) {
      user = (await getAuthUser(c)) || undefined;
      if (user) c.set("user", user);
    }
    if (!user) {
      return c.json({ success: false, message: "Authentication required. Please sign in." }, 401);
    }
    if (allowedRoles.length > 0 && !allowedRoles.includes(user.userType)) {
      return c.json({ success: false, message: "Forbidden: insufficient permissions." }, 403);
    }
    await next();
  };
}

/**
 * Resolves the authorized organization for the current request.
 * Ensures the user belongs to the requested organization (by shortCode or orgId).
 * Prevents unauthorized cross-organization tampering.
 */
export async function resolveAuthorizedOrg(
  c: Context<AppEnv>,
  options: { allowPublic?: boolean } = {}
): Promise<{ organizationId: string; shortCode: string } | null> {
  const reqShortCode = (
    c.req.header("x-shortcode") ||
    c.req.query("shortCode") ||
    c.req.param("shortCode") ||
    ""
  ).trim().toUpperCase();

  const reqOrgId = (
    c.req.header("x-organization-id") ||
    c.req.query("organizationId") ||
    ""
  ).trim();

  const db = getUniversalDb(c.env?.DB);

  // If public employee / guest QR ordering is permitted
  if (options.allowPublic) {
    if (reqShortCode) {
      const org = (await db
        .prepare(`SELECT id, short_code as shortCode FROM organizations WHERE UPPER(short_code) = ?`)
        .bind(reqShortCode)
        .get()) as any;
      if (org) return { organizationId: String(org.id), shortCode: org.shortCode };
    }
    if (reqOrgId) {
      const org = (await db
        .prepare(`SELECT id, short_code as shortCode FROM organizations WHERE id = ?`)
        .bind(reqOrgId)
        .get()) as any;
      if (org) return { organizationId: String(org.id), shortCode: org.shortCode };
    }
  }

  const user = await getAuthUser(c);
  if (!user) {
    return null;
  }

  // Fetch all organizations the user belongs to from user_organizations
  const userOrgs = (await db
    .prepare(
      `SELECT o.id, o.short_code as shortCode, uo.role 
       FROM organizations o
       JOIN user_organizations uo ON o.id = uo.organization_id
       WHERE uo.user_id = ?`
    )
    .bind(user.id)
    .all()) as any[];

  if (!userOrgs || userOrgs.length === 0) {
    return null;
  }

  // If a specific organization was requested, ensure the user has access to it
  if (reqShortCode) {
    const match = userOrgs.find((o) => (o.shortCode || "").toUpperCase() === reqShortCode);
    if (!match) {
      // User is attempting to access an organization they do not belong to!
      return null;
    }
    return { organizationId: String(match.id), shortCode: match.shortCode };
  }

  if (reqOrgId) {
    const match = userOrgs.find((o) => String(o.id) === reqOrgId);
    if (!match) {
      return null;
    }
    return { organizationId: String(match.id), shortCode: match.shortCode };
  }

  // Default to user's first organization
  return { organizationId: String(userOrgs[0].id), shortCode: userOrgs[0].shortCode };
}
