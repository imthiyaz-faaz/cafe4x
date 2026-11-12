import { Context } from "hono";
import { orderController } from "./order.controller";
import { locationController } from "./location.controller";
import { getUniversalDb } from "../db";
import { resolveAuthorizedOrg, getAuthUser } from "../middleware/auth.middleware";
import { AppEnv } from "../types";

export const providerController = {
  // GET /api/provider/dashboard?providerId=xxx
  async getDashboard(c: Context) {
    try {
      const providerId = c.req.query("providerId");
      return c.json({
        success: true,
        message: "Provider dashboard active",
        providerId,
      });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // GET /api/provider/location/:locationId/summary
  // Returns provider-scoped location dashboard statistics, assigned tables with pending order counts, and recent orders
  async getLocationSummary(c: Context<AppEnv>) {
    try {
      const org = await resolveAuthorizedOrg(c);
      if (!org) {
        return c.json({ success: false, message: "Unauthorized or invalid organization context" }, 403);
      }

      const authUser = await getAuthUser(c);
      if (!authUser) {
        return c.json({ success: false, message: "Unauthorized" }, 401);
      }

      const isProvider = authUser.userType === "Provider";
      const providerUserId = isProvider ? authUser.id : (c.req.query("providerId") || authUser.id);
      const locationId = c.req.param("locationId");
      const db = getUniversalDb(c.env?.DB);

      // Verify location
      const loc = (await db
        .prepare(
          `SELECT id, name, status, image, total_seats, table_limit 
           FROM locations 
           WHERE (id = ? OR display_id = ?) AND organization_id = ?`
        )
        .bind(locationId, locationId, org.organizationId)
        .get()) as any;

      if (!loc) {
        return c.json({ success: false, message: "Location not found in this organization" }, 404);
      }

      const effectiveLocId = loc.id;
      const todayDate = new Date().toISOString().slice(0, 10);

      // 1. Fetch tables assigned to this provider in this location
      // Query location_tables joining table_provider_assignments and location_providers
      let tablesRows: any[] = [];
      try {
        tablesRows = (await db
          .prepare(
            `SELECT 
               t.id,
               t.location_id as locationId,
               t.table_name as name,
               t.table_limit as seatLimit,
               CASE WHEN t.status = 'active' THEN 1 ELSE 0 END as isActive,
               COUNT(DISTINCT s.id) as totalSeats,
               COUNT(DISTINCT CASE WHEN s.status = 'occupied' OR (s.employee_id IS NOT NULL AND s.employee_id != '') OR (s.employee_email IS NOT NULL AND s.employee_email != '') THEN s.id END) as occupiedSeats
             FROM location_tables t
             LEFT JOIN table_provider_assignments tpa ON t.id = tpa.table_id
             LEFT JOIN location_providers lp ON tpa.location_provider_id = lp.id
             LEFT JOIN location_table_seats s ON t.id = s.table_id
             WHERE t.location_id = ?
               AND (
                 lp.provider_id = ?
                 OR t.provider_id = ?
                 OR (? = 'false' AND ? = 'Admin')
               )
             GROUP BY t.id
             ORDER BY t.id ASC`
          )
          .bind(effectiveLocId, providerUserId, providerUserId, isProvider ? 'true' : 'false', authUser.userType)
          .all()) as any[];
      } catch (errLt) {
        // Fallback to tables
        tablesRows = (await db
          .prepare(
            `SELECT 
               t.id,
               t.location_id as locationId,
               t.name,
               t.seat_limit as seatLimit,
               t.is_active as isActive,
               COUNT(DISTINCT s.id) as totalSeats,
               COUNT(DISTINCT CASE WHEN s.status = 'occupied' OR (s.employee_id IS NOT NULL AND s.employee_id != '') OR (s.employee_email IS NOT NULL AND s.employee_email != '') THEN s.id END) as occupiedSeats
             FROM tables t
             LEFT JOIN table_provider_assignments tpa ON t.id = tpa.table_id
             LEFT JOIN location_providers lp ON tpa.location_provider_id = lp.id
             LEFT JOIN seats s ON t.id = s.table_id
             WHERE t.location_id = ?
               AND (
                 lp.provider_id = ?
                 OR t.provider_id = ?
                 OR (? = 'false' AND ? = 'Admin')
               )
             GROUP BY t.id
             ORDER BY t.id ASC`
          )
          .bind(effectiveLocId, providerUserId, providerUserId, isProvider ? 'true' : 'false', authUser.userType)
          .all()) as any[];
      }

      const assignedTableIds = (tablesRows || []).map((t) => Number(t.id));

      // 2. Fetch pending order counts per table for assigned tables
      const tablePendingCounts = new Map<number, number>();
      if (assignedTableIds.length > 0) {
        const placeholders = assignedTableIds.map(() => "?").join(",");
        try {
          const countRows = (await db
            .prepare(
              `SELECT ord_s.table_id as tableId, COUNT(o.id) as pendingCount
               FROM orders o
               JOIN seats ord_s ON o.seat_id = ord_s.id
               WHERE o.organization_id = ? 
                 AND o.location_id = ?
                 AND ord_s.table_id IN (${placeholders})
                 AND LOWER(o.status) = 'pending'
               GROUP BY ord_s.table_id`
            )
            .bind(org.organizationId, effectiveLocId, ...assignedTableIds)
            .all()) as any[];

          for (const cr of countRows || []) {
            tablePendingCounts.set(Number(cr.tableId), Number(cr.pendingCount) || 0);
          }
        } catch {}
      }

      // Format tables list
      const tables = (tablesRows || []).map((t) => {
        const seatLimit = Number(t.seatLimit) || 0;
        const occupiedSeats = Number(t.occupiedSeats) || 0;
        const availableSeats = Math.max(0, seatLimit - occupiedSeats);
        const pendingCount = tablePendingCounts.get(Number(t.id)) || 0;

        return {
          id: Number(t.id),
          name: t.name,
          seatLimit,
          occupiedSeats,
          availableSeats,
          isActive: Number(t.isActive) === 1 ? 1 : 0,
          pendingOrderCount: pendingCount,
        };
      });

      // 3. Compute 5 Stats Cards scoped strictly to the provider's assigned tables
      let pendingOrders = 0;
      let preparingOrders = 0;
      let readyOrders = 0;
      let deliveredToday = 0;

      if (assignedTableIds.length > 0) {
        const placeholders = assignedTableIds.map(() => "?").join(",");
        try {
          const statsRows = (await db
            .prepare(
              `SELECT 
                 LOWER(o.status) as statusLower,
                 date(o.created_at) as orderDate,
                 COUNT(o.id) as cnt
               FROM orders o
               JOIN seats ord_s ON o.seat_id = ord_s.id
               WHERE o.organization_id = ?
                 AND o.location_id = ?
                 AND ord_s.table_id IN (${placeholders})
               GROUP BY LOWER(o.status), date(o.created_at)`
            )
            .bind(org.organizationId, effectiveLocId, ...assignedTableIds)
            .all()) as any[];

          for (const sr of statsRows || []) {
            const st = (sr.statusLower || "").trim();
            const count = Number(sr.cnt) || 0;
            const od = sr.orderDate;

            if (st === "pending") {
              pendingOrders += count;
            } else if (st === "preparing") {
              preparingOrders += count;
            } else if (st === "ready") {
              readyOrders += count;
            } else if (st === "delivered" && od === todayDate) {
              deliveredToday += count;
            }
          }
        } catch {}
      }

      // 4. Fetch Table-Wise Recent Orders (top 6 recent orders for assigned tables)
      let recentOrders: any[] = [];
      if (assignedTableIds.length > 0) {
        const placeholders = assignedTableIds.map(() => "?").join(",");
        try {
          const oRows = (await db
            .prepare(
              `SELECT 
                 o.id,
                 COALESCE(o.display_id, o.id) as displayId,
                 o.status,
                 o.created_at as createdAt,
                 o.time,
                 o.items_json as itemsJson,
                 ord_s.number as seatNumber,
                 ord_t.name as tableName,
                 ord_t.id as tableId
               FROM orders o
               JOIN seats ord_s ON o.seat_id = ord_s.id
               JOIN tables ord_t ON ord_s.table_id = ord_t.id
               WHERE o.organization_id = ?
                 AND o.location_id = ?
                 AND ord_s.table_id IN (${placeholders})
               ORDER BY o.created_at DESC
               LIMIT 8`
            )
            .bind(org.organizationId, effectiveLocId, ...assignedTableIds)
            .all()) as any[];

          recentOrders = (oRows || []).map((r) => {
            let firstItemImage = "";
            let firstItemName = "";
            try {
              const parsed = r.itemsJson ? JSON.parse(r.itemsJson) : [];
              if (parsed.length > 0) {
                firstItemImage = parsed[0]?.image || "";
                firstItemName = parsed[0]?.name || "";
              }
            } catch {}

            return {
              id: r.id,
              displayId: r.displayId,
              tableName: r.tableName || `Table ${r.tableId}`,
              tableId: r.tableId,
              seatNumber: r.seatNumber,
              status: r.status,
              time: r.time,
              createdAt: r.createdAt,
              firstItemImage,
              firstItemName,
            };
          });
        } catch {}
      }

      return c.json({
        success: true,
        location: {
          id: effectiveLocId,
          name: loc.name,
          status: loc.status,
          image: loc.image || "",
          totalSeats: Number(loc.total_seats) || 0,
        },
        stats: {
          myTables: tables.length,
          pendingOrders,
          preparingOrders,
          readyOrders,
          deliveredToday,
        },
        tables,
        recentOrders,
      });
    } catch (err: any) {
      console.error("getLocationSummary error:", err);
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // GET /api/provider/orders
  getOrders: orderController.getOrders,

  // PATCH /api/provider/orders/:id/status
  updateOrderStatus: orderController.updateStatus,

  // GET /api/provider/locations
  getAssignedLocations: locationController.getLocations,
};
