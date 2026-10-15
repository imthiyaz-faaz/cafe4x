import { Context } from "hono";
import { getDb } from "../db";

export interface UserModel {
  id: string;
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

export let usersStore: UserModel[] = [];

export function syncFromDb() {
  try {
    const db = getDb();
    const rows = db.prepare(`
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
    `).all() as any[];

    if (rows && rows.length > 0) {
      usersStore = rows.map((r) => ({
        id: String(r.id),
        name: r.name,
        userName: r.userName,
        password: r.password,
        email: r.email,
        mobileNumber: r.mobileNumber || "",
        userType: r.userType,
        organizationId: r.organizationId,
        shortCode: r.shortCode,
        organization: r.organization || "",
        createdAt: r.createdAt,
      }));
    }
  } catch (err) {
    console.warn("Could not sync from SQLite, using in-memory store:", err);
  }
}

// Initialize on load
syncFromDb();

export const userController = {
  // GET /api/users
  async getUsers(c: Context) {
    try {
      syncFromDb();
      const type = c.req.query("type");
      const shortCode = c.req.query("shortCode");
      const organization = c.req.query("organization");

      let list = [...usersStore];
      if (type) {
        list = list.filter((u) => u.userType.toLowerCase() === type.toLowerCase());
      }
      if (shortCode) {
        list = list.filter((u) => (u.shortCode || "").toUpperCase() === shortCode.toUpperCase());
      } else if (organization) {
        list = list.filter((u) => (u.organization || "").toLowerCase() === organization.toLowerCase());
      }

      const safeUsers = list.map(({ password: _, ...rest }) => rest);
      return c.json({ success: true, users: safeUsers });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // GET /api/users/:id
  async getUserById(c: Context) {
    try {
      const id = c.req.param("id");
      const user = usersStore.find((u) => u.id === id);
      if (!user) {
        return c.json({ success: false, message: "User not found" }, 404);
      }
      const { password: _, ...safe } = user;
      return c.json({ success: true, user: safe });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // POST /api/users (Created from Users Page or Signup)
  async createUser(c: Context) {
    try {
      const body = await c.req.json();
      const identifier = (body.email || body.userName || "").trim().toLowerCase();

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

      // Check if duplicate user exists
      const exists = usersStore.some(
        (u) =>
          u.email.toLowerCase() === body.email.trim().toLowerCase() ||
          u.userName.toLowerCase() === body.userName.trim().toLowerCase()
      );

      if (exists) {
        return c.json({
          success: false,
          message: "A user with this email or username already exists",
        }, 409);
      }

      const newUserId = body.id ? String(body.id) : Date.now().toString();
      const orgName = (body.organization || "Default Org").trim();
      const orgShort = (body.shortCode || "HQ").trim().toUpperCase();
      const orgId = body.organizationId || `org_${orgShort.toLowerCase()}_${Date.now()}`;

      try {
        const db = getDb();
        // Upsert organization
        db.prepare(`
          INSERT INTO organizations (id, name, short_code)
          VALUES (?, ?, ?)
          ON CONFLICT(short_code) DO UPDATE SET name = excluded.name
        `).run(orgId, orgName, orgShort);

        // Fetch actual org id
        const orgRow = db.prepare(`SELECT id FROM organizations WHERE short_code = ?`).get(orgShort) as any;
        const actualOrgId = orgRow ? orgRow.id : orgId;

        // Insert user
        db.prepare(`
          INSERT INTO users (id, name, user_name, password, email, mobile_number, user_type)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          newUserId,
          body.name.trim(),
          body.userName.trim(),
          body.password.trim(),
          body.email.trim().toLowerCase(),
          body.mobileNumber ? String(body.mobileNumber).trim() : "",
          body.userType || "Admin"
        );

        // Link in user_organizations
        db.prepare(`
          INSERT OR IGNORE INTO user_organizations (id, user_id, organization_id, role)
          VALUES (?, ?, ?, ?)
        `).run(`uo_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, newUserId, actualOrgId, body.userType === "Admin" ? "Owner" : "Member");
      } catch (dbErr) {
        console.warn("Could not insert user directly into SQLite:", dbErr);
      }

      const newUser: UserModel = {
        id: newUserId,
        name: body.name.trim(),
        userName: body.userName.trim(),
        password: body.password.trim(),
        email: body.email.trim().toLowerCase(),
        mobileNumber: body.mobileNumber ? String(body.mobileNumber).trim() : "",
        organization: orgName,
        shortCode: orgShort,
        organizationId: orgId,
        userType: body.userType || "Admin",
        createdAt: new Date().toISOString(),
      };

      usersStore.push(newUser);
      const { password: _, ...safeUser } = newUser;

      return c.json({
        success: true,
        message: "User created successfully",
        user: safeUser,
      }, 201);
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // PUT /api/users/:id
  async updateUser(c: Context) {
    try {
      const id = c.req.param("id");
      const body = await c.req.json();
      const index = usersStore.findIndex((u) => u.id === id);

      if (index === -1) {
        return c.json({ success: false, message: "User not found" }, 404);
      }

      const updatedName = body.name !== undefined ? body.name : usersStore[index].name;
      const updatedUserName = body.userName !== undefined ? body.userName : usersStore[index].userName;
      const updatedEmail = body.email !== undefined ? body.email.toLowerCase() : usersStore[index].email;
      const updatedMobile = body.mobileNumber !== undefined ? body.mobileNumber : usersStore[index].mobileNumber;
      const updatedType = body.userType !== undefined ? body.userType : usersStore[index].userType;
      const updatedPass = body.password ? body.password : usersStore[index].password;

      try {
        const db = getDb();
        db.prepare(`
          UPDATE users 
          SET name = ?, user_name = ?, email = ?, mobile_number = ?, user_type = ?, password = ?
          WHERE id = ?
        `).run(updatedName, updatedUserName, updatedEmail, updatedMobile, updatedType, updatedPass, id);
      } catch (dbErr) {
        console.warn("Could not update user in SQLite:", dbErr);
      }

      usersStore[index] = {
        ...usersStore[index],
        name: updatedName,
        userName: updatedUserName,
        email: updatedEmail,
        mobileNumber: updatedMobile,
        userType: updatedType,
        password: updatedPass,
      };

      const { password: _, ...safe } = usersStore[index];
      return c.json({ success: true, user: safe });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // DELETE /api/users/:id
  async deleteUser(c: Context) {
    try {
      const id = c.req.param("id");
      try {
        const db = getDb();
        db.prepare(`DELETE FROM users WHERE id = ?`).run(id);
      } catch (dbErr) {
        console.warn("Could not delete user from SQLite:", dbErr);
      }
      usersStore = usersStore.filter((u) => u.id !== id);
      return c.json({ success: true, message: "User deleted successfully" });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },
};
