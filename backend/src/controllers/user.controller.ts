import { Context } from "hono";
import { getUniversalDb } from "../db";
import { AppEnv } from "../types";
import { resolveAuthorizedOrg } from "../middleware/auth.middleware";
import { getNextId, generateId, hashPassword, generateSecureQrToken } from "../utils/id-generator";
import { validateUserCreation, validatePhone } from "../utils/validation";

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
  // GET /api/users/check-username?username=xyz
  async checkUsername(c: Context<AppEnv>) {
    try {
      const username = (c.req.query("username") || "").trim().toLowerCase();
      if (!username) {
        return c.json({ success: false, available: false, message: "Username is required" }, 400);
      }

      if (username.length < 3) {
        return c.json({ success: false, available: false, message: "Username must be at least 3 characters long" }, 400);
      }

      const db = getUniversalDb(c.env?.DB);
      const org = await resolveAuthorizedOrg(c).catch(() => null);

      if (org) {
        // Check organization-level username duplicate
        const existingInOrg = (await db
          .prepare(
            `SELECT u.id, u.user_name as userName
             FROM users u
             JOIN user_organizations uo ON u.id = uo.user_id
             WHERE uo.organization_id = ? AND LOWER(TRIM(u.user_name)) = LOWER(?)`
          )
          .bind(org.organizationId, username)
          .get()) as any;

        if (existingInOrg) {
          return c.json({
            success: true,
            available: false,
            message: "This username already exists in this organization. Please choose another username.",
          });
        }
      } else {
        // Fallback to global user check
        const existing = (await db
          .prepare(`SELECT id FROM users WHERE LOWER(TRIM(user_name)) = LOWER(?)`)
          .bind(username)
          .get()) as any;

        if (existing) {
          return c.json({
            success: true,
            available: false,
            message: "This username is already taken. Please choose another username.",
          });
        }
      }

      return c.json({
        success: true,
        available: true,
        message: "Username is available.",
      });
    } catch (err: any) {
      console.error("userController.checkUsername error:", err);
      return c.json({ success: false, message: "Error checking username availability" }, 500);
    }
  },
  // GET /api/users
  async getUsers(c: Context<AppEnv>) {
    try {
      const org = await resolveAuthorizedOrg(c);
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
      } else {
        query += ` AND u.user_type IN ('Admin', 'Provider')`;
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
      const errMsg = err?.message || "";
      if (errMsg.includes("USERNAME_ALREADY_EXISTS_IN_ORG") || errMsg.includes("trg_prevent_dup_username")) {
        return c.json({
          success: false,
          code: "USERNAME_ALREADY_EXISTS_IN_ORG",
          message: "This username already exists in this organization. Please choose another username.",
        }, 409);
      }
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

      // 1. Validate all fields with common validation schema
      const validation = validateUserCreation(body, {
        requireConfirmPassword: body.confirmPassword !== undefined,
      });

      if (!validation.isValid) {
        const firstError = Object.values(validation.errors)[0];
        return c.json(
          {
            success: false,
            message: firstError,
            errors: validation.errors,
          },
          400
        );
      }

      const db = getUniversalDb(c.env?.DB);
      const email = body.email.trim().toLowerCase();
      const userName = body.userName.trim();

      // 2. Check username and email availability across users table
      const duplicateErrors: { userName?: string; email?: string } = {};

      const existingUserName = (await db
        .prepare(`SELECT id FROM users WHERE LOWER(TRIM(user_name)) = LOWER(?)`)
        .bind(userName)
        .get()) as any;

      if (existingUserName) {
        duplicateErrors.userName = "This username is already taken. Please choose another username.";
      }

      const existingEmail = (await db
        .prepare(`SELECT id, email FROM users WHERE LOWER(TRIM(email)) = LOWER(?)`)
        .bind(email)
        .get()) as any;

      if (existingEmail) {
        duplicateErrors.email = "This email address is already registered. Please use another email.";
      }

      if (Object.keys(duplicateErrors).length > 0) {
        const code = duplicateErrors.userName && duplicateErrors.email
          ? "DUPLICATE_USER_CREDENTIALS"
          : (duplicateErrors.userName ? "USERNAME_ALREADY_EXISTS" : "EMAIL_ALREADY_EXISTS");
        const firstMessage = Object.values(duplicateErrors)[0];

        return c.json(
          {
            success: false,
            code,
            message: firstMessage,
            errors: duplicateErrors,
          },
          409
        );
      }

      const phoneRes = validatePhone(body.mobileNumber, body.countryCode || "IN");
      const formattedMobile = phoneRes.e164Number || body.mobileNumber.trim();

      const newUserId = await generateId(db, "USR");
      const displayId = newUserId;
      const hashedPassword = await hashPassword(body.password.trim());
      const now = new Date().toISOString();
      const generatedQrToken = generateSecureQrToken(16);

      // 3. Insert into users table with graceful UNIQUE constraint handling
      try {
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
            formattedMobile,
            body.userType === "Provider" ? "Provider" : "Admin",
            generatedQrToken,
            now,
            "active",
            now
          );
      } catch (insertErr: any) {
        const errMsg = String(insertErr?.message || "");
        if (errMsg.includes("UNIQUE") || errMsg.includes("SQLITE_CONSTRAINT")) {
          const errors: { userName?: string; email?: string } = {};
          if (errMsg.toLowerCase().includes("user_name")) {
            errors.userName = "This username is already taken. Please choose another username.";
          }
          if (errMsg.toLowerCase().includes("email")) {
            errors.email = "This email address is already registered. Please use another email.";
          }
          if (Object.keys(errors).length === 0) {
            errors.userName = "This username is already taken. Please choose another username.";
          }
          return c.json(
            {
              success: false,
              code: "DUPLICATE_USER_CREDENTIALS",
              message: Object.values(errors)[0],
              errors,
            },
            409
          );
        }
        throw insertErr;
      }

      // 4. Link to organization
      const role = body.userType === "Admin" ? "Owner" : (body.userType === "Provider" ? "Provider" : "Member");
      const uorId = await generateId(db, "UOR");
      await db
        .prepare(
          `INSERT INTO user_organizations (id, user_id, organization_id, role, created_at)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(uorId, newUserId, org.organizationId, role, now);

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
            mobileNumber: formattedMobile,
            userType: body.userType === "Provider" ? "Provider" : "Admin",
            organizationId: org.organizationId,
            shortCode: org.shortCode,
            organization: org.shortCode,
            qrToken: generatedQrToken,
            qrTokenStatus: "active",
            createdAt: now,
          },
        },
        201
      );
    } catch (err: any) {
      console.error("userController.createUser error:", err);
      const errMsg = String(err?.message || "");
      if (errMsg.includes("UNIQUE") || errMsg.includes("SQLITE_CONSTRAINT")) {
        const errors: { userName?: string; email?: string } = {};
        if (errMsg.toLowerCase().includes("user_name")) {
          errors.userName = "This username is already taken. Please choose another username.";
        }
        if (errMsg.toLowerCase().includes("email")) {
          errors.email = "This email address is already registered. Please use another email.";
        }
        if (Object.keys(errors).length === 0) {
          errors.userName = "This username is already taken. Please choose another username.";
        }
        return c.json(
          {
            success: false,
            code: "DUPLICATE_USER_CREDENTIALS",
            message: Object.values(errors)[0],
            errors,
          },
          409
        );
      }
      return c.json({ success: false, message: errMsg || "Failed to create user" }, 500);
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
      const newUserName = body.userName ? body.userName.trim() : null;

      if (newUserName) {
        if (newUserName.length < 3) {
          return c.json({ success: false, message: "Username must be at least 3 characters long" }, 400);
        }

        const usernameInOrg = (await db
          .prepare(
            `SELECT u.id, u.user_name as userName, u.user_type as userType
             FROM users u
             JOIN user_organizations uo ON u.id = uo.user_id
             WHERE uo.organization_id = ? AND u.id != ? AND LOWER(TRIM(u.user_name)) = LOWER(?)`
          )
          .bind(org.organizationId, targetUserId, newUserName)
          .get()) as any;

        if (usernameInOrg) {
          return c.json({
            success: false,
            code: "USERNAME_ALREADY_EXISTS_IN_ORG",
            message: `Username "${newUserName}" is already taken in this organization.`,
          }, 409);
        }
      }

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
      const errMsg = err?.message || "";
      if (errMsg.includes("USERNAME_ALREADY_EXISTS_IN_ORG") || errMsg.includes("trg_prevent_dup_username")) {
        return c.json({
          success: false,
          code: "USERNAME_ALREADY_EXISTS_IN_ORG",
          message: "This username already exists in this organization. Please choose another username.",
        }, 409);
      }
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

      // Find user by id or display_id
      const targetUser = (await db
        .prepare(`SELECT id, display_id as displayId, name, user_name as userName, email, user_type as userType FROM users WHERE id = ? OR display_id = ?`)
        .bind(id, id)
        .get()) as any;

      if (!targetUser) {
        return c.json({ success: false, message: "User not found" }, 404);
      }

      const targetUserId = String(targetUser.id);

      // Verify that this user belongs to the current organization
      const orgLink = (await db
        .prepare(`SELECT id FROM user_organizations WHERE user_id = ? AND organization_id = ?`)
        .bind(targetUserId, org.organizationId)
        .get()) as any;

      if (!orgLink) {
        return c.json({ success: false, message: "User not found in this organization" }, 404);
      }

      // 1. Unassign from locations (set assigned_provider_id, assigned_provider_name, assigned_provider_email to NULL)
      await db
        .prepare(
          `UPDATE locations 
           SET assigned_provider_id = NULL, assigned_provider_name = NULL, assigned_provider_email = NULL 
           WHERE assigned_provider_id = ?`
        )
        .bind(targetUserId)
        .run();

      // 2. Unassign from seats (set employee_id, employee_name, employee_email, employee to NULL)
      await db
        .prepare(
          `UPDATE seats 
           SET employee_id = NULL, employee_name = NULL, employee_email = NULL, employee = NULL 
           WHERE employee_id = ?`
        )
        .bind(targetUserId)
        .run();

      // 3. Clear owner reference in organizations if matching
      await db
        .prepare(`UPDATE organizations SET owner_user_id = NULL WHERE owner_user_id = ?`)
        .bind(targetUserId)
        .run();

      // 4. Delete user sessions (immediately revokes all active auth tokens)
      await db
        .prepare(`DELETE FROM user_sessions WHERE user_id = ?`)
        .bind(targetUserId)
        .run();

      // 5. Delete provider locations
      await db
        .prepare(`DELETE FROM provider_locations WHERE provider_id = ?`)
        .bind(targetUserId)
        .run();

      // 6. Delete ordering sessions
      await db
        .prepare(`DELETE FROM ordering_sessions WHERE employee_id = ?`)
        .bind(targetUserId)
        .run();

      // 7. Delete organization link
      await db
        .prepare(`DELETE FROM user_organizations WHERE user_id = ?`)
        .bind(targetUserId)
        .run();

      // 8. Permanently delete from users table
      await db
        .prepare(`DELETE FROM users WHERE id = ?`)
        .bind(targetUserId)
        .run();

      return c.json({
        success: true,
        message: `User "${targetUser.name}" (${targetUser.userType}) permanently deleted successfully.`,
      });
    } catch (err: any) {
      console.error("userController.deleteUser error:", err);
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
            o.name as organization,
            o.currency_code as currency
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
      const newToken = generateSecureQrToken(16);
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
