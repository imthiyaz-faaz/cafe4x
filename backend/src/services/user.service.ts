import { getDb } from "../db";
import { UserModel } from "../controllers/user.controller";

export const userBackendService = {
  async getUsers(organizationId: string): Promise<UserModel[]> {
    const db = getDb();
    const rows = (await db
      .prepare(
        `SELECT u.id, u.name, u.user_name as userName, u.email, u.mobile_number as mobileNumber, u.user_type as userType
         FROM users u
         JOIN user_organizations uo ON u.id = uo.user_id
         WHERE uo.organization_id = ?`
      )
      .bind(organizationId)
      .all()) as any[];
    return rows;
  },
};

export default userBackendService;
