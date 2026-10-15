import { getDb } from "../db";
import { UserModel, usersStore } from "../controllers/user.controller";
import { organizationsStore, OrganizationModel } from "../controllers/organization.controller";

export interface SignupInput {
  name?: string;
  userName?: string;
  email: string;
  password?: string;
  organization?: string;
  shortCode?: string;
  mobileNumber?: string;
  userType?: "Admin" | "Provider" | "Staff" | string;
  id?: string;
}

export const authBackendService = {
  getUserOrganizations(userId: string, shortCode?: string, fallbackOrg?: string): any[] {
    let userOrgs: any[] = [];
    try {
      const db = getDb();
      userOrgs = db
        .prepare(
          `
        SELECT o.id, o.name, o.short_code as shortCode, o.owner_user_id as ownerUserId
        FROM organizations o
        JOIN user_organizations uo ON o.id = uo.organization_id
        WHERE uo.user_id = ?
        ORDER BY o.created_at DESC
      `
        )
        .all(userId) as any[];
    } catch {}

    if (userOrgs.length === 0) {
      userOrgs = organizationsStore.filter(
        (o) => o.ownerUserId === userId || (shortCode && o.shortCode === shortCode)
      );
      if (userOrgs.length === 0 && fallbackOrg) {
        userOrgs = [
          {
            id: `org_${shortCode ? shortCode.toLowerCase() : "default"}_${Date.now()}`,
            name: fallbackOrg,
            shortCode: shortCode || "HQ",
          },
        ];
      }
    }
    return userOrgs;
  },

  registerUser(input: SignupInput): { user: Omit<UserModel, "password">; token: string } {
    const email = (input.email || "").trim().toLowerCase();
    const userName = (input.userName || input.name || "").trim().toLowerCase();
    const password = (input.password || "").trim();
    const newUserId = input.id ? String(input.id) : Date.now().toString();
    const orgName = (input.organization || "Default Org").trim();
    const orgShort = (input.shortCode || "HQ").trim().toUpperCase();
    const orgId = `org_${orgShort.toLowerCase()}_${Date.now()}`;
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
        input.name || userName || "User",
        userName || email.split("@")[0],
        password,
        email,
        input.mobileNumber || "",
        (input.userType as any) || "Admin"
      );

      db.prepare(
        `
        INSERT OR IGNORE INTO user_organizations (id, user_id, organization_id, role)
        VALUES (?, ?, ?, 'Owner')
      `
      ).run(`uo_${Date.now()}`, newUserId, actualOrgId);
    } catch (dbErr) {
      console.warn("Could not write user to SQLite:", dbErr);
    }

    try {
      organizationsStore.unshift({
        id: orgId,
        name: orgName,
        shortCode: orgShort,
        ownerUserId: newUserId,
        createdAt: now,
      });
    } catch {}

    const newUser: UserModel = {
      id: newUserId,
      name: input.name || userName || "User",
      userName: userName || email.split("@")[0],
      email,
      password,
      mobileNumber: input.mobileNumber || "",
      organization: orgName,
      shortCode: orgShort,
      organizationId: orgId,
      userType: (input.userType as any) || "Admin",
      createdAt: now,
    };

    usersStore.push(newUser);
    const { password: _, ...userSafe } = newUser;

    return {
      user: userSafe,
      token: `cafe4x_token_${newUser.id}_${Date.now()}`,
    };
  },
};

export default authBackendService;
