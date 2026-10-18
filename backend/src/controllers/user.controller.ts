import { Context } from "hono";
import { getUniversalDb } from "../db";
import { AppEnv } from "../types";
import { resolveAuthorizedOrg } from "../middleware/auth.middleware";
import { getNextId, hashPassword, generateSecureQrToken } from "../utils/id-generator";

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
  qrToken?: string | null;
  qrTokenCreatedAt?: string | null;
  qrTokenStatus?: string;
  createdAt: string;
}

export const userController = {
  // GET /api/users
  async getUsers(c: Context<AppEnv>) {
    try {
      const org = await resolveAuthorizedOrg(c, { allowPublic: true });
      if (!org) {
        return c.json({ success: false, message: "Organization not found or access denied" }, 403);
      }

      const db = getUniversalDb(c.env?.DB);
      const type = c.req.query("type");

      let query = `
        SELECT 
          u.id, 
          u.display_id as displayId,
          u.name, 
          u.user_name as userName, 
          u.email, 
          u.mobile_number as mobileNumber, 
          u.user_type as userType, 
          u.qr_token as qrToken,
          u.qr_token_created_at as qrTokenCreatedAt,
          u.qr_token_status as qrTokenStatus,
          o.id as organizationId, 
          o.short_code as shortCode,
          o.name as organization,
          u.created_at as createdAt
        FROM users u
        JOIN user_organizations uo ON u.id = uo.user_id
        JOIN organizations o ON uo.organization_id = o.id
        WHERE o.id = ?
      `;
      const params: any[] = [org.organizationId];

      if (type) {
        query += ` AND LOWER(u.user_type) = LOWER(?)`;
        params.push(type);
      }

      query += ` ORDER BY u.created_at DESC`;

      const rows = (await db.prepare(query).bind(...params).all()) as any[];

      const safeUsers = (rows || []).map((r) => ({
        id: String(r.id),
        displayId: r.displayId || `USR-${r.id}`,
        name: r.name,
        userName: r.userName,
        email: r.email,
        mobileNumber: r.mobileNumber || "",
        userType: r.userType,
        organizationId: r.organizationId,
        shortCode: r.shortCode,
        organization: r.organization || "",
        qrToken: r.qrToken || null,
        qrTokenCreatedAt: r.qrTokenCreatedAt || null,
        qrTokenStatus: r.qrTokenStatus || "active",
        createdAt: r.createdAt,
      }));

      return c.json({ success: true, users: safeUsers });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // GET /api/users/:id
  async getUserById(c: Context<AppEnv>) {
    try {
      const id = c.req.param("id");
      const db = getUniversalDb(c.env?.DB);

      const row = (await db
        .prepare(
          `SELECT 
            u.id, u.display_id as displayId, u.name, u.user_name as userName, u.email,
            u.mobile_number as mobileNumber, u.user_type as userType,
            u.qr_token as qrToken, u.qr_token_created_at as qrTokenCreatedAt, u.qr_token_status as qrTokenStatus,
            o.id as organizationId, o.short_code as shortCode, o.name as organization,
            u.created_at as createdAt
           FROM users u
           LEFT JOIN user_organizations uo ON u.id = uo.user_id
           LEFT JOIN organizations o ON uo.organization_id = o.id
           WHERE u.id = ? OR u.display_id = ?`
        )
        .bind(id, id)
        .get()) as any;

      if (!row) {
        return c.json({ success: false, message: "User not found" }, 404);
      }

      return c.json({
        success: true,
        user: {
          id: String(row.id),
          displayId: row.displayId,
          name: row.name,
          userName: row.userName,
          email: row.email,
          mobileNumber: row.mobileNumber || "",
          userType: row.userType,
          organizationId: row.organizationId,
          shortCode: row.shortCode,
          organization: row.organization || "",
          qrToken: row.qrToken || null,
          qrTokenCreatedAt: row.qrTokenCreatedAt || null,
          qrTokenStatus: row.qrTokenStatus || "active",
          createdAt: row.createdAt,
        },
      });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },


  // POST /api/users
  async createUser(c: Context<AppEnv>) {
    try {
      const org = await resolveAuthorizedOrg(c);
      if (!org) {
        return c.json({ success: false, message: "Unauthorized or invalid organization context" }, 403);
      }

      const body = await c.req.json();
      if (!body.name || !body.name.trim()) {
        return c.json({ success: false, message: "Name is required" }, 400);
      }
      if (!body.userName || !body.userName.trim()) {
        return c.json({ success: false, message: "User Name is required" }, 400);
      }
      if (!body.password || !body.password.trim()) {
        return c.json({ success: false, message: "Password is required" }, 400);
      }
      if (!body.email || !body.email.trim()) {
        return c.json({ success: false, message: "Email is required" }, 400);
      }

      const db = getUniversalDb(c.env?.DB);
      const email = body.email.trim().toLowerCase();
      const userName = body.userName.trim().toLowerCase();

      // Check if user already exists
      let existingUser = (await db
        .prepare(`SELECT id, display_id as displayId, name, user_name as userName, email FROM users WHERE LOWER(email) = ? OR LOWER(user_name) = ?`)
        .bind(email, userName)
        .get()) as any;

      const { displayId: generatedDisplayId } = await getNextId(db, "USER");
      const newUserId = existingUser ? existingUser.id : (body.id ? String(body.id) : generatedDisplayId);
      const displayId = existingUser ? existingUser.displayId : generatedDisplayId;
      const hashedPassword = await hashPassword(body.password.trim());
      const now = new Date().toISOString();

      const generatedQrToken = generateSecureQrToken(24);

      if (!existingUser) {
        await db
          .prepare(
            `INSERT INTO users (id, display_id, name, user_name, password, password_hash, email, mobile_number, user_type, qr_token, qr_token_created_at, qr_token_status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            newUserId,
            displayId,
            body.name.trim(),
            userName,
            body.password.trim(),
            hashedPassword,
            email,
            body.mobileNumber ? String(body.mobileNumber).trim() : "",
            body.userType || "Staff",
            generatedQrToken,
            now,
            "active",
            now
          );
      } else {
        // If user already existed without a QR token, ensure they have one
        const userRow = (await db.prepare(`SELECT qr_token FROM users WHERE id = ?`).bind(newUserId).get()) as any;
        if (!userRow?.qr_token) {
          await db
            .prepare(`UPDATE users SET qr_token = ?, qr_token_created_at = ?, qr_token_status = 'active' WHERE id = ?`)
            .bind(generatedQrToken, now, newUserId)
            .run();
        }
      }

      // Check if user is already linked to this organization
      const link = (await db
        .prepare(`SELECT id FROM user_organizations WHERE user_id = ? AND organization_id = ?`)
        .bind(newUserId, org.organizationId)
        .get()) as any;

      if (link) {
        return c.json({
          success: false,
          message: "A user with this email or username is already in this organization",
        }, 409);
      }

      // Link to organization
      const role = body.userType === "Admin" ? "Owner" : (body.userType === "Provider" ? "Provider" : "Member");
      await db
        .prepare(
          `INSERT INTO user_organizations (id, user_id, organization_id, role, created_at)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(`uo_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, newUserId, org.organizationId, role, now);

      return c.json(
        {
          success: true,
          message: "User created successfully",
          user: {
            id: newUserId,
            displayId,
            name: body.name.trim(),
            userName,
            email,
            mobileNumber: body.mobileNumber ? String(body.mobileNumber).trim() : "",
            userType: body.userType || "Staff",
            organizationId: org.organizationId,
            shortCode: org.shortCode,
            qrToken: generatedQrToken,
            qrTokenStatus: "active",
            createdAt: now,
          },
        },
        201
      );
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // PUT /api/users/:id
  async updateUser(c: Context<AppEnv>) {
    try {
      const org = await resolveAuthorizedOrg(c);
      if (!org) {
        return c.json({ success: false, message: "Unauthorized or invalid organization context" }, 403);
      }

      const id = c.req.param("id");
      const body = await c.req.json();
      const db = getUniversalDb(c.env?.DB);

      const link = (await db
        .prepare(`SELECT user_id as userId FROM user_organizations WHERE (user_id = ? OR user_id IN (SELECT id FROM users WHERE display_id = ?)) AND organization_id = ?`)
        .bind(id, id, org.organizationId)
        .get()) as any;

      if (!link) {
        return c.json({ success: false, message: "User not found in this organization" }, 404);
      }

      const targetUserId = link.userId;
      const newHash = body.password ? await hashPassword(body.password.trim()) : null;

      await db
        .prepare(
          `UPDATE users 
           SET 
             name = COALESCE(?, name),
             user_name = COALESCE(?, user_name),
             email = COALESCE(?, email),
             mobile_number = COALESCE(?, mobile_number),
             user_type = COALESCE(?, user_type),
             password = COALESCE(?, password),
             password_hash = COALESCE(?, password_hash)
           WHERE id = ?`
        )
        .run(
          body.name ? body.name.trim() : null,
          body.userName ? body.userName.trim() : null,
          body.email ? body.email.toLowerCase() : null,
          body.mobileNumber !== undefined ? body.mobileNumber : null,
          body.userType !== undefined ? body.userType : null,
          body.password ? body.password : null,
          newHash,
          targetUserId
        );

      const updated = (await db
        .prepare(`SELECT id, display_id as displayId, name, user_name as userName, email, mobile_number as mobileNumber, user_type as userType FROM users WHERE id = ?`)
        .bind(targetUserId)
        .get()) as any;

      return c.json({ success: true, user: updated });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // DELETE /api/users/:id
  async deleteUser(c: Context<AppEnv>) {
    try {
      const org = await resolveAuthorizedOrg(c);
      if (!org) {
        return c.json({ success: false, message: "Unauthorized or invalid organization context" }, 403);
      }

      const id = c.req.param("id");
      const db = getUniversalDb(c.env?.DB);

      const res = await db
        .prepare(`DELETE FROM user_organizations WHERE (user_id = ? OR user_id IN (SELECT id FROM users WHERE display_id = ?)) AND organization_id = ?`)
        .bind(id, id, org.organizationId)
        .run();

      if (res.changes === 0) {
        return c.json({ success: false, message: "User not found in this organization" }, 404);
      }

      return c.json({ success: true, message: "User removed from organization successfully" });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // GET /api/users/qr-token/:token (Public)
  async validateQrToken(c: Context<AppEnv>) {
    try {
      const token = c.req.param("token");
      if (!token || !token.trim()) {
        return c.json({ success: false, message: "Invalid token" }, 400);
      }

      const db = getUniversalDb(c.env?.DB);

      const row = (await db
        .prepare(
          `SELECT 
            u.id, 
            u.display_id as displayId, 
            u.name, 
            u.user_name as userName, 
            u.email, 
            u.user_type as userType,
            u.qr_token as qrToken,
            u.qr_token_status as qrTokenStatus,
            o.id as organizationId, 
            o.short_code as shortCode, 
            o.name as organization
           FROM users u
           JOIN user_organizations uo ON u.id = uo.user_id
           JOIN organizations o ON uo.organization_id = o.id
           WHERE u.qr_token = ?`
        )
        .bind(token.trim())
        .get()) as any;

      if (!row) {
        return c.json({ success: false, message: "QR ordering link is invalid or does not exist." }, 404);
      }

      if (row.qrTokenStatus !== "active") {
        return c.json({ success: false, message: "This QR ordering link has been revoked. Please ask your administrator for a new QR code." }, 403);
      }

      return c.json({
        success: true,
        employee: {
          id: String(row.id),
          displayId: row.displayId,
          name: row.name,
          email: row.email,
        },
        organization: {
          id: row.organizationId,
          shortCode: row.shortCode,
          name: row.organization,
        },
      });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // POST /api/users/:id/qr-token/regenerate (Admin only)
  async regenerateQrToken(c: Context<AppEnv>) {
    try {
      const org = await resolveAuthorizedOrg(c);
      if (!org) {
        return c.json({ success: false, message: "Unauthorized or invalid organization context" }, 403);
      }

      const id = c.req.param("id");
      const db = getUniversalDb(c.env?.DB);

      // Verify user belongs to this organization
      const link = (await db
        .prepare(`SELECT user_id as userId FROM user_organizations WHERE (user_id = ? OR user_id IN (SELECT id FROM users WHERE display_id = ?)) AND organization_id = ?`)
        .bind(id, id, org.organizationId)
        .get()) as any;

      if (!link) {
        return c.json({ success: false, message: "User not found in this organization" }, 404);
      }

      const targetUserId = link.userId;
      const newToken = generateSecureQrToken(24);
      const now = new Date().toISOString();

      await db
        .prepare(`UPDATE users SET qr_token = ?, qr_token_created_at = ?, qr_token_status = 'active' WHERE id = ?`)
        .bind(newToken, now, targetUserId)
        .run();

      const userRow = (await db
        .prepare(`SELECT id, display_id as displayId, name, email, qr_token as qrToken, qr_token_status as qrTokenStatus FROM users WHERE id = ?`)
        .bind(targetUserId)
        .get()) as any;

      return c.json({
        success: true,
        message: "QR ordering token regenerated successfully",
        qrToken: newToken,
        qrTokenStatus: "active",
        user: userRow,
      });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // POST /api/users/:id/qr-token/revoke (Admin only)
  async revokeQrToken(c: Context<AppEnv>) {
    try {
      const org = await resolveAuthorizedOrg(c);
      if (!org) {
        return c.json({ success: false, message: "Unauthorized or invalid organization context" }, 403);
      }

      const id = c.req.param("id");
      const db = getUniversalDb(c.env?.DB);

      // Verify user belongs to this organization
      const link = (await db
        .prepare(`SELECT user_id as userId FROM user_organizations WHERE (user_id = ? OR user_id IN (SELECT id FROM users WHERE display_id = ?)) AND organization_id = ?`)
        .bind(id, id, org.organizationId)
        .get()) as any;

      if (!link) {
        return c.json({ success: false, message: "User not found in this organization" }, 404);
      }

      const targetUserId = link.userId;

      await db
        .prepare(`UPDATE users SET qr_token_status = 'revoked' WHERE id = ?`)
        .bind(targetUserId)
        .run();

      return c.json({
        success: true,
        message: "QR ordering token revoked successfully",
        qrTokenStatus: "revoked",
      });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },
};
