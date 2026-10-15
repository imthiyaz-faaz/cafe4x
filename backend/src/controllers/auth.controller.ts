import { Context } from "hono";
import { usersStore, syncFromDb, UserModel } from "./user.controller";
import { getDb } from "../db";

export const authController = {
  async login(c: Context) {
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

      // Always sync latest state from SQLite
      syncFromDb();

      // Check matching user from centralized usersStore or directly from DB
      let matched = usersStore.find(
        (u) =>
          (u.email.toLowerCase() === identifier || u.userName.toLowerCase() === identifier) &&
          u.password === password
      );

      if (!matched) {
        try {
          const db = getDb();
          const row = db.prepare(`
            SELECT 
              u.id, 
              u.name, 
              u.user_name as userName, 
              u.password, 
              u.email, 
              u.mobile_number as mobileNumber, 
              u.user_type as userType, 
              o.id as organizationId, 
              o.short_code as shortCode,
              o.name as organization,
              u.created_at as createdAt
            FROM users u
            LEFT JOIN user_organizations uo ON u.id = uo.user_id
            LEFT JOIN organizations o ON uo.organization_id = o.id
            WHERE (LOWER(u.email) = ? OR LOWER(u.user_name) = ?) AND u.password = ?
          `).get(identifier, identifier, password) as any;

          if (row) {
            matched = {
              id: String(row.id),
              name: row.name,
              userName: row.userName,
              password: row.password,
              email: row.email,
              mobileNumber: row.mobileNumber || "",
              userType: row.userType,
              organizationId: row.organizationId,
              shortCode: row.shortCode,
              organization: row.organization || "",
              createdAt: row.createdAt,
            };
          }
        } catch (dbErr) {
          console.warn("Direct DB login query error:", dbErr);
        }
      }

      if (matched) {
        const { password: _, ...userSafe } = matched;

        // Fetch organizations linked to this user
        let userOrgs: any[] = [];
        try {
          const { getDb } = await import("../db");
          const db = getDb();
          userOrgs = db.prepare(`
            SELECT o.id, o.name, o.short_code as shortCode, o.owner_user_id as ownerUserId
            FROM organizations o
            JOIN user_organizations uo ON o.id = uo.organization_id
            WHERE uo.user_id = ?
            ORDER BY o.created_at DESC
          `).all(matched.id) as any[];
        } catch {}
console.log(userOrgs)
        if (userOrgs.length === 0) {
          const { organizationsStore } = await import("./organization.controller");
          userOrgs = organizationsStore.filter(
            (o) => o.ownerUserId === matched.id || o.shortCode === matched.shortCode
          );
          if (userOrgs.length === 0 && matched.organization) {
            userOrgs = [{
              id: matched.organizationId || "org_default",
              name: matched.organization,
              shortCode: matched.shortCode || "HQ",
            }];
          }
        }

        return c.json({
          success: true,
          message: "Login successful",
          token: `cafe4x_token_${matched.id}_${Date.now()}`,
          user: userSafe,
          organizations: userOrgs,
        }, 200);
      }

      return c.json({
        success: false,
        message: "Invalid username/email or password.",
      }, 401);
    } catch (err: any) {
      return c.json({
        success: false,
        message: err.message || "An error occurred during login",
      }, 500);
    }
  },

  async signup(c: Context) {
    try {
      const body = await c.req.json();
      const email = (body.email || "").trim().toLowerCase();
      const userName = (body.userName || body.name || "").trim().toLowerCase();
      const password = (body.password || "").trim();

      if (!email || !password) {
        return c.json({ success: false, message: "Email and password are required" }, 400);
      }

      const exists = usersStore.some(
        (u) => u.email.toLowerCase() === email || u.userName.toLowerCase() === userName
      );

      if (exists) {
        return c.json({ success: false, message: "User already exists" }, 409);
      }

      const newUserId = body.id ? String(body.id) : Date.now().toString();
      const orgName = (body.organization || "Default Org").trim();
      const orgShort = (body.shortCode || "HQ").trim().toUpperCase();
      const orgId = `org_${orgShort.toLowerCase()}_${Date.now()}`;

      try {
        const { getDb } = await import("../db");
        const db = getDb();

        // 1. Insert organization
        db.prepare(`
          INSERT INTO organizations (id, name, short_code)
          VALUES (?, ?, ?)
          ON CONFLICT(short_code) DO UPDATE SET name = excluded.name
        `).run(orgId, orgName, orgShort);

        const orgRow = db.prepare(`SELECT id FROM organizations WHERE short_code = ?`).get(orgShort) as any;
        const actualOrgId = orgRow ? orgRow.id : orgId;

        // 2. Insert user
        db.prepare(`
          INSERT INTO users (id, name, user_name, password, email, mobile_number, user_type)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          newUserId,
          body.name || userName || "User",
          userName || email.split("@")[0],
          password,
          email,
          body.mobileNumber || "",
          body.userType || "Admin"
        );

        // 3. Link in user_organizations table
        db.prepare(`
          INSERT OR IGNORE INTO user_organizations (id, user_id, organization_id, role)
          VALUES (?, ?, ?, 'Owner')
        `).run(`uo_${Date.now()}`, newUserId, actualOrgId);
      } catch (dbErr) {
        console.warn("Could not write user to SQLite:", dbErr);
      }

      try {
        const { organizationsStore } = await import("./organization.controller");
        organizationsStore.unshift({
          id: orgId,
          name: orgName,
          shortCode: orgShort,
          ownerUserId: newUserId,
          createdAt: new Date().toISOString(),
        });
      } catch {}

      const newUser: UserModel = {
        id: newUserId,
        name: body.name || userName || "User",
        userName: userName || email.split("@")[0],
        email,
        password,
        mobileNumber: body.mobileNumber || "",
        organization: orgName,
        shortCode: orgShort,
        organizationId: orgId,
        userType: body.userType || "Admin",
        createdAt: new Date().toISOString(),
      };

      usersStore.push(newUser);
      const { password: _, ...userSafe } = newUser;

      return c.json({
        success: true,
        message: "User registered successfully",
        user: userSafe,
        token: `cafe4x_token_${newUser.id}_${Date.now()}`,
      }, 201);
    } catch (err: any) {
      return c.json({ success: false, message: err.message || "Invalid request" }, 400);
    }
  },

  // GET /api/auth/me (validates token/session)
  async me(c: Context) {
    const authHeader = c.req.header("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return c.json({ success: false, message: "Unauthorized" }, 401);
    }

    const token = authHeader.replace("Bearer ", "").trim();
    // In-memory token parsing
    const parts = token.split("_");
    const userId = parts[2];
    const user = usersStore.find((u) => u.id === userId);

    if (user) {
      const { password: _, ...safe } = user;
      return c.json({ success: true, user: safe });
    }

    return c.json({ success: true, message: "Token valid" });
  },
};
