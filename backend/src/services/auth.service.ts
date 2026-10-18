import { getDb } from "../db";
import { UserModel } from "../controllers/user.controller";
import { OrganizationModel } from "../controllers/organization.controller";

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
  async getUserOrganizations(userId: string, shortCode?: string): Promise<any[]> {
    let userOrgs: any[] = [];
    try {
      const db = getDb();
      userOrgs = (await db
        .prepare(
          `SELECT o.id, o.name, o.short_code as shortCode, o.owner_user_id as ownerUserId
           FROM organizations o
           JOIN user_organizations uo ON o.id = uo.organization_id
           WHERE uo.user_id = ?
           ORDER BY o.created_at DESC`
        )
        .bind(userId)
        .all()) as any[];
    } catch {}

    return userOrgs;
  },
};

export default authBackendService;
