import { OrderModel } from "../controllers/order.controller";
import { getDb } from "../db";

export const orderBackendService = {
  async getOrders(orgId: string): Promise<OrderModel[]> {
    const db = getDb();
    const rows = (await db
      .prepare(`SELECT * FROM orders WHERE organization_id = ? ORDER BY created_at DESC`)
      .bind(orgId)
      .all()) as any[];
    return rows;
  },
};

export default orderBackendService;
