import { Context } from "hono";
import { getUniversalDb } from "../db";
import { AppEnv } from "../types";
import { getNextId, hashPassword, verifyPassword, sha256Hex } from "../utils/id-generator";
import { getAuthUser } from "../middleware/auth.middleware";

export interface UserModel {
  id: string;
  displayId?: string;
  name: string;
  userName: string;
  password?: string;
  userType: "Admin" | "Provider" | "Staff";
  email: string;
  mobileNumber?: string;
  organization?: string;
  shortCode?: string;
  organizationId?: string;
  createdAt: string;
}

export const authController = {
  async login(c: Context<AppEnv>) {
    try {
      const body = await c.req.json();
      const identifier = (body.usernameOrEmail || body.username || body.email || "").trim().toLowerCase();
      const password = (body.password || "").trim();

      if (!identifier || !password) {
        return c.json({
          success: false,
          message: "Please provide both username/email and password",
        }, 400);
      }

      const db = getUniversalDb(c.env?.DB);

      // Query user by email or user_name
      const row = (await db
        .prepare(
          `SELECT 
            u.id, 
            u.display_id as displayId,
            u.name, 
            u.user_name as userName, 
            u.password, 
            u.password_hash as passwordHash,
            u.email, 
            u.mobile_number as mobileNumber, 
            u.user_type as userType, 
            u.created_at as createdAt
          FROM users u
          WHERE LOWER(u.email) = ? OR LOWER(u.user_name) = ?`
        )
        .bind(identifier, identifier)
        .get()) as any;

      if (!row) {
        return c.json({
          success: false,
          message: "Invalid username/email or password.",
        }, 401);
      }

      // Verify password securely
      const storedHash = row.passwordHash || row.password;
      const isValid = await verifyPassword(password, storedHash);
      if (!isValid) {
        return c.json({
          success: false,
          message: "Invalid username/email or password.",
        }, 401);
      }

      // If user had legacy plaintext password, transparently upgrade to password_hash
      if (!row.passwordHash) {
        try {
          const newHash = await hashPassword(password);
          await db
            .prepare(`UPDATE users SET password_hash = ? WHERE id = ?`)
            .run(newHash, row.id);
        } catch {}
      }

      // Fetch organizations linked to this user in user_organizations
      const userOrgs = (await db
        .prepare(
          `SELECT o.id, o.display_id as displayId, o.name, o.short_code as shortCode, o.owner_user_id as ownerUserId, uo.role
           FROM organizations o
           JOIN user_organizations uo ON o.id = uo.organization_id
           WHERE uo.user_id = ?
           ORDER BY o.created_at DESC`
        )
        .bind(row.id)
        .all()) as any[];

      const primaryOrg = userOrgs.length > 0 ? userOrgs[0] : null;

      const userSafe: UserModel = {
        id: String(row.id),
        displayId: row.displayId || `USR-${row.id}`,
        name: row.name,
        userName: row.userName,
        email: row.email,
        mobileNumber: row.mobileNumber || "",
        userType: row.userType,
        organizationId: primaryOrg ? primaryOrg.id : undefined,
        shortCode: primaryOrg ? primaryOrg.shortCode : undefined,
        organization: primaryOrg ? primaryOrg.name : undefined,
        createdAt: row.createdAt,
      };

      const token = `cafe4x_token_${row.id}_${Date.now()}`;
      try {
        const tokenHash = await sha256Hex(token);
        const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        await db
          .prepare(
            `INSERT INTO user_sessions (id, token_hash, user_id, expires_at)
             VALUES (?, ?, ?, ?)`
          )
          .run(sessionId, tokenHash, String(row.id), expiresAt);
      } catch (sessErr) {
        console.warn("Could not record session:", sessErr);
      }

      return c.json({
        success: true,
        message: "Login successful",
        token,
        user: userSafe,
        organizations: userOrgs,
      }, 200);
    } catch (err: any) {
      return c.json({
        success: false,
        message: err.message || "An error occurred during login",
      }, 500);
    }
  },

  async signup(c: Context<AppEnv>) {
    try {
      const body = await c.req.json();
      const email = (body.email || "").trim().toLowerCase();
      const userName = (body.userName || body.name || "").trim().toLowerCase();
      const password = (body.password || "").trim();

      if (!email || !password) {
        return c.json({ success: false, message: "Email and password are required" }, 400);
      }

      const db = getUniversalDb(c.env?.DB);

      // Check if user already exists
      const exists = (await db
        .prepare(`SELECT id FROM users WHERE LOWER(email) = ? OR LOWER(user_name) = ?`)
        .bind(email, userName)
        .get()) as any;

      if (exists) {
        return c.json({ success: false, message: "User with this email or username already exists" }, 409);
      }

      const orgName = (body.organization || "Default Org").trim();
      const orgShort = (body.shortCode || "HQ").trim().toUpperCase();
      const now = new Date().toISOString();

      // Generate meaningful sequential IDs
      const { displayId: userDisplayId } = await getNextId(db, "USER");
      const { displayId: orgDisplayId } = await getNextId(db, "ORG", orgShort);

      const newUserId = body.id ? String(body.id) : userDisplayId;
      const orgId = `org_${orgShort.toLowerCase()}_${Date.now()}`;
      const hashedPassword = await hashPassword(password);

      // 1. Insert organization
      await db
        .prepare(
          `INSERT INTO organizations (id, display_id, name, short_code, owner_user_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(short_code) DO UPDATE SET name = excluded.name`
        )
        .run(orgId, orgDisplayId, orgName, orgShort, newUserId, now);

      const orgRow = (await db.prepare(`SELECT id, display_id as displayId FROM organizations WHERE short_code = ?`).bind(orgShort).get()) as any;
      const actualOrgId = orgRow ? orgRow.id : orgId;
      const actualOrgDisplayId = orgRow ? orgRow.displayId : orgDisplayId;

      // 2. Insert user with hashed password and readable display_id
      await db
        .prepare(
          `INSERT INTO users (id, display_id, name, user_name, password, password_hash, email, mobile_number, user_type, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          newUserId,
          userDisplayId,
          body.name || userName || "User",
          userName || email.split("@")[0],
          password, // for backward-compatibility if referenced
          hashedPassword,
          email,
          body.mobileNumber || "",
          body.userType || "Admin",
          now
        );

      // 3. Link user as Owner in user_organizations
      await db
        .prepare(
          `INSERT OR IGNORE INTO user_organizations (id, user_id, organization_id, role, created_at)
           VALUES (?, ?, ?, 'Owner', ?)`
        )
        .run(`uo_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, newUserId, actualOrgId, now);

      const userSafe: UserModel = {
        id: newUserId,
        displayId: userDisplayId,
        name: body.name || userName || "User",
        userName: userName || email.split("@")[0],
        email,
        mobileNumber: body.mobileNumber || "",
        organization: orgName,
        shortCode: orgShort,
        organizationId: actualOrgId,
        userType: body.userType || "Admin",
        createdAt: now,
      };

      const token = `cafe4x_token_${newUserId}_${Date.now()}`;
      try {
        const tokenHash = await sha256Hex(token);
        const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        await db
          .prepare(
            `INSERT INTO user_sessions (id, token_hash, user_id, expires_at)
             VALUES (?, ?, ?, ?)`
          )
          .run(sessionId, tokenHash, String(newUserId), expiresAt);
      } catch (sessErr) {
        console.warn("Could not record session:", sessErr);
      }

      return c.json({
        success: true,
        message: "User registered successfully",
        user: userSafe,
        token,
        organizations: [
          {
            id: actualOrgId,
            displayId: actualOrgDisplayId,
            name: orgName,
            shortCode: orgShort,
            role: "Owner",
          },
        ],
      }, 201);
    } catch (err: any) {
      return c.json({ success: false, message: err.message || "Invalid request" }, 400);
    }
  },

  // GET /api/auth/me (validates token/session)
  async me(c: Context<AppEnv>) {
    const authUser = await getAuthUser(c);
    if (!authUser) {
      return c.json({ success: false, message: "Unauthorized. Session is invalid or has expired." }, 401);
    }

    const db = getUniversalDb(c.env?.DB);
    const user = (await db
      .prepare(
        `SELECT id, display_id as displayId, name, user_name as userName, email, mobile_number as mobileNumber, user_type as userType, created_at as createdAt
         FROM users WHERE id = ?`
      )
      .bind(authUser.id)
      .get()) as any;

    if (!user) {
      return c.json({ success: false, message: "User not found." }, 404);
    }

    const userOrgs = (await db
      .prepare(
        `SELECT o.id, o.display_id as displayId, o.name, o.short_code as shortCode, o.owner_user_id as ownerUserId, uo.role
         FROM organizations o
         JOIN user_organizations uo ON o.id = uo.organization_id
         WHERE uo.user_id = ?
         ORDER BY o.created_at DESC`
      )
      .bind(user.id)
      .all()) as any[];

    const primaryOrg = userOrgs.length > 0 ? userOrgs[0] : null;

    return c.json({
      success: true,
      user: {
        id: String(user.id),
        displayId: user.displayId || `USR-${user.id}`,
        name: user.name,
        userName: user.userName,
        email: user.email,
        mobileNumber: user.mobileNumber || "",
        userType: user.userType,
        organizationId: primaryOrg ? primaryOrg.id : undefined,
        shortCode: primaryOrg ? primaryOrg.shortCode : undefined,
        organization: primaryOrg ? primaryOrg.name : undefined,
        createdAt: user.createdAt,
      },
      organizations: userOrgs,
    });
  },

  // POST /api/auth/logout (revokes current session)
  async logout(c: Context<AppEnv>) {
    const authHeader = c.req.header("Authorization") || "";
    if (authHeader.startsWith("Bearer ")) {
      const rawToken = authHeader.replace("Bearer ", "").trim();
      try {
        const db = getUniversalDb(c.env?.DB);
        const tokenHash = await sha256Hex(rawToken);
        const nowIso = new Date().toISOString();
        await db
          .prepare(`UPDATE user_sessions SET revoked_at = ? WHERE token_hash = ?`)
          .bind(nowIso, tokenHash)
          .run();
      } catch (err) {
        console.warn("Error revoking session:", err);
      }
    }
    return c.json({ success: true, message: "Logged out successfully" });
  },
};
