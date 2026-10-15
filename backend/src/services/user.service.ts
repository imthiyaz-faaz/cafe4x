import { getDb } from "../db";
import { UserModel, usersStore } from "../controllers/user.controller";

export interface CreateUserInput {
  id?: string;
  name: string;
  userName: string;
  password?: string;
  email: string;
  mobileNumber?: string;
  userType?: "Admin" | "Provider" | "Staff" | string;
  organization?: string;
  shortCode?: string;
  organizationId?: string;
}

export const userBackendService = {
  syncFromDb(): UserModel[] {
    try {
      const db = getDb();
      const rows = db
        .prepare(
          `
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
      `
        )
        .all() as any[];

      if (rows && rows.length > 0) {
        return rows.map((r) => ({
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
      console.warn("Could not sync from SQLite:", err);
    }
    return usersStore;
  },

  createUser(body: CreateUserInput): UserModel {
    const newUserId = body.id ? String(body.id) : Date.now().toString();
    const orgName = (body.organization || "Default Org").trim();
    const orgShort = (body.shortCode || "HQ").trim().toUpperCase();
    const orgId = body.organizationId || `org_${orgShort.toLowerCase()}_${Date.now()}`;
    const now = new Date().toISOString();

    try {
      const db = getDb();
      db.prepare(
        `
        INSERT INTO organizations (id, name, short_code)
        VALUES (?, ?, ?)
        ON CONFLICT(short_code) DO UPDATE SET name = excluded.name
      `
      ).run(orgId, orgName, orgShort);

      const orgRow = db
        .prepare(`SELECT id FROM organizations WHERE short_code = ?`)
        .get(orgShort) as any;
      const actualOrgId = orgRow ? orgRow.id : orgId;

      db.prepare(
        `
        INSERT INTO users (id, name, user_name, password, email, mobile_number, user_type)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `
      ).run(
        newUserId,
        body.name.trim(),
        body.userName.trim(),
        body.password ? body.password.trim() : "",
        body.email.trim().toLowerCase(),
        body.mobileNumber ? String(body.mobileNumber).trim() : "",
        body.userType || "Admin"
      );

      db.prepare(
        `
        INSERT OR IGNORE INTO user_organizations (id, user_id, organization_id, role)
        VALUES (?, ?, ?, ?)
      `
      ).run(
        `uo_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        newUserId,
        actualOrgId,
        body.userType === "Admin" ? "Owner" : "Member"
      );
    } catch (dbErr) {
      console.warn("Could not insert user directly into SQLite:", dbErr);
    }

    const newUser: UserModel = {
      id: newUserId,
      name: body.name.trim(),
      userName: body.userName.trim(),
      password: body.password ? body.password.trim() : "",
      email: body.email.trim().toLowerCase(),
      mobileNumber: body.mobileNumber ? String(body.mobileNumber).trim() : "",
      organization: orgName,
      shortCode: orgShort,
      organizationId: orgId,
      userType: (body.userType as any) || "Admin",
      createdAt: now,
    };

    return newUser;
  },

  updateUser(id: string, updates: Partial<UserModel>): void {
    try {
      const db = getDb();
      db.prepare(
        `
        UPDATE users 
        SET name = COALESCE(?, name), user_name = COALESCE(?, user_name), email = COALESCE(?, email), mobile_number = COALESCE(?, mobile_number), user_type = COALESCE(?, user_type), password = COALESCE(?, password)
        WHERE id = ?
      `
      ).run(
        updates.name || null,
        updates.userName || null,
        updates.email ? updates.email.toLowerCase() : null,
        updates.mobileNumber || null,
        updates.userType || null,
        updates.password || null,
        id
      );
    } catch (dbErr) {
      console.warn("Could not update user in SQLite:", dbErr);
    }
  },

  deleteUser(id: string): void {
    try {
      const db = getDb();
      db.prepare(`DELETE FROM users WHERE id = ?`).run(id);
    } catch (dbErr) {
      console.warn("Could not delete user from SQLite:", dbErr);
    }
  },
};

export default userBackendService;
