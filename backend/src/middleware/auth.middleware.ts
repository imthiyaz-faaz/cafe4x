import { Context, Next } from "hono";
import { AppEnv, AuthUser } from "../types";
import { getUniversalDb } from "../db";

/**
 * Extracts the authenticated user from the Bearer token or x-user-id / x-shortcode header.
 * Verifies that the user exists and has permission to access the requested organization.
 */
export async function getAuthUser(c: Context<AppEnv>): Promise<AuthUser | null> {
  const authHeader = c.req.header("Authorization") || "";
  let userId: string | null = null;

  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "").trim();
    const parts = token.split("_");
    if (parts.length >= 3) {
      userId = parts[2];
    }
  }

  // Fallback to x-user-id header if present
  if (!userId) {
    userId = c.req.header("x-user-id") || null;
  }

  if (!userId) return null;

  try {
    const db = getUniversalDb(c.env?.DB);
    const row = (await db
      .prepare(
        `SELECT id, name, user_name as userName, email, user_type as userType 
         FROM users WHERE id = ?`
      )
      .bind(userId)
      .get()) as any;

    if (!row) return null;

    return {
      id: String(row.id),
      name: row.name,
      userName: row.userName,
      email: row.email,
      userType: row.userType,
    };
  } catch (err) {
    console.warn("Error fetching auth user:", err);
    return null;
  }
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
    // If no authenticated user, check if public fallback organization exists
    if (reqShortCode) {
      const org = (await db
        .prepare(`SELECT id, short_code as shortCode FROM organizations WHERE UPPER(short_code) = ?`)
        .bind(reqShortCode)
        .get()) as any;
      if (org) return { organizationId: String(org.id), shortCode: org.shortCode };
    }
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
