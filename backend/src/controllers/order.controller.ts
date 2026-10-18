import { Context } from "hono";
import { getUniversalDb } from "../db";
import { AppEnv } from "../types";
import { resolveAuthorizedOrg, getAuthUser } from "../middleware/auth.middleware";
import { getNextId } from "../utils/id-generator";

export interface OrderItem {
  id?: string;
  itemId?: string;
  name: string;
  qty: number;
  price: number;
  preference?: string;
}

export interface OrderModel {
  id: string;
  displayId?: string;
  organizationId: string;
  shortCode: string;
  seat: string;
  locationName: string;
  locationId?: string;
  employeeName: string;
  items: OrderItem[];
  total: number;
  time: string;
  status: "Pending" | "Preparing" | "Ready" | "Delivered" | "Canceled";
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export const orderController = {
  // GET /api/orders
  async getOrders(c: Context<AppEnv>) {
    try {
      const org = await resolveAuthorizedOrg(c, { allowPublic: true });
      if (!org) {
        return c.json({ success: false, message: "Organization not found or access denied" }, 403);
      }

      const db = getUniversalDb(c.env?.DB);
      const authUser = await getAuthUser(c);
      const location = c.req.query("location");
      const status = c.req.query("status");

      let query = `
        SELECT 
          o.id, 
          o.display_id as displayId,
          o.organization_id as organizationId, 
          o.short_code as shortCode,
          o.seat, 
          o.location_id as locationId, 
          o.location_name as locationName,
          o.employee_name as employeeName, 
          o.total, 
          o.time, 
          o.status, 
          o.notes,
          o.items_json as itemsJson, 
          o.created_at as createdAt, 
          o.updated_at as updatedAt
        FROM orders o
      `;
      const params: any[] = [];

      // If user is Provider, only return orders from locations assigned to that provider
      if (authUser?.userType === "Provider") {
        query += `
          LEFT JOIN locations loc ON o.location_id = loc.id
          LEFT JOIN provider_locations pl ON o.location_id = pl.location_id
          WHERE o.organization_id = ? AND (loc.assigned_provider_id = ? OR pl.provider_id = ?)
        `;
        params.push(org.organizationId, authUser.id, authUser.id);
      } else {
        query += ` WHERE o.organization_id = ?`;
        params.push(org.organizationId);
      }

      if (location) {
        query += ` AND (LOWER(o.location_name) = LOWER(?) OR o.location_id = ?)`;
        params.push(location, location);
      }

      if (status) {
        query += ` AND o.status = ?`;
        params.push(status);
      }

      query += ` ORDER BY o.created_at DESC`;

      const rows = (await db.prepare(query).bind(...params).all()) as any[];

      // Fetch normalized order_items for these orders if present
      const orders: OrderModel[] = await Promise.all(
        (rows || []).map(async (r) => {
          let items: OrderItem[] = [];
          try {
            const dbItems = (await db
              .prepare(`SELECT id, item_id as itemId, name, qty, unit_price as price, preference FROM order_items WHERE order_id = ?`)
              .bind(r.id)
              .all()) as any[];

            if (dbItems && dbItems.length > 0) {
              items = dbItems.map((di) => ({
                id: di.id,
                itemId: di.itemId || undefined,
                name: di.name,
                qty: di.qty,
                price: di.price,
                preference: di.preference || undefined,
              }));
            } else if (r.itemsJson) {
              items = JSON.parse(r.itemsJson);
            }
          } catch {
            if (r.itemsJson) {
              try {
                items = JSON.parse(r.itemsJson);
              } catch {}
            }
          }

          return {
            id: r.id,
            displayId: r.displayId || r.id,
            organizationId: r.organizationId || org.organizationId,
            shortCode: r.shortCode || org.shortCode,
            seat: r.seat,
            locationId: r.locationId || undefined,
            locationName: r.locationName,
            employeeName: r.employeeName,
            items,
            total: Number(r.total) || 0,
            time: r.time,
            status: r.status,
            notes: r.notes || undefined,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
          };
        })
      );

      return c.json({ success: true, orders });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // GET /api/orders/:id
  async getOrderById(c: Context<AppEnv>) {
    try {
      const id = c.req.param("id");
      const db = getUniversalDb(c.env?.DB);

      const row = (await db
        .prepare(
          `SELECT 
            id, display_id as displayId, organization_id as organizationId, short_code as shortCode,
            seat, location_id as locationId, location_name as locationName,
            employee_name as employeeName, total, time, status, notes,
            items_json as itemsJson, created_at as createdAt, updated_at as updatedAt
           FROM orders WHERE id = ? OR display_id = ?`
        )
        .bind(id, id)
        .get()) as any;

      if (!row) {
        return c.json({ success: false, message: "Order not found" }, 404);
      }

      let items: OrderItem[] = [];
      try {
        const dbItems = (await db
          .prepare(`SELECT id, item_id as itemId, name, qty, unit_price as price, preference FROM order_items WHERE order_id = ?`)
          .bind(row.id)
          .all()) as any[];

        if (dbItems && dbItems.length > 0) {
          items = dbItems.map((di) => ({
            id: di.id,
            itemId: di.itemId || undefined,
            name: di.name,
            qty: di.qty,
            price: di.price,
            preference: di.preference || undefined,
          }));
        } else if (row.itemsJson) {
          items = JSON.parse(row.itemsJson);
        }
      } catch {}

      return c.json({
        success: true,
        order: {
          id: row.id,
          displayId: row.displayId || row.id,
          organizationId: row.organizationId,
          shortCode: row.shortCode,
          seat: row.seat,
          locationId: row.locationId || undefined,
          locationName: row.locationName,
          employeeName: row.employeeName,
          items,
          total: Number(row.total) || 0,
          time: row.time,
          status: row.status,
          notes: row.notes || undefined,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        },
      });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // POST /api/orders
  async createOrder(c: Context<AppEnv>) {
    try {
      const org = await resolveAuthorizedOrg(c, { allowPublic: true });
      if (!org) {
        return c.json({ success: false, message: "Organization not found or invalid context" }, 403);
      }

      const body = await c.req.json();
      const now = new Date();
      const db = getUniversalDb(c.env?.DB);

      // Generate readable display ID e.g. ORD-FTS-2026-000001
      const { displayId } = await getNextId(db, "ORD", org.shortCode);
      const orderId = body.id || displayId;

      const seat = String(body.seat || "01").padStart(2, "0");
      const locationName = body.locationName || "Office";
      const locationId = body.locationId || null;
      const employeeName = body.employeeName || `Seat ${seat} Guest`;
      const items = Array.isArray(body.items) ? body.items : [];
      const total = Number(body.total) || 0;
      const time = body.time && body.time !== "Just now"
        ? body.time
        : now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
      const status = "Pending";
      const notes = body.notes || null;
      const itemsJson = JSON.stringify(items);
      const isoNow = now.toISOString();

      await db
        .prepare(
          `INSERT INTO orders (
            id, display_id, organization_id, short_code, seat, location_id, location_name,
            employee_name, total, time, status, notes, items_json,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          orderId,
          displayId,
          org.organizationId,
          org.shortCode,
          seat,
          locationId,
          locationName,
          employeeName,
          total,
          time,
          status,
          notes,
          itemsJson,
          isoNow,
          isoNow
        );

      // Populate normalized order_items table
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const oiId = `oi_${orderId}_${i + 1}`;
        try {
          await db
            .prepare(
              `INSERT INTO order_items (id, order_id, organization_id, item_id, name, qty, unit_price, preference, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .run(
              oiId,
              orderId,
              org.organizationId,
              it.itemId || null,
              it.name,
              it.qty || 1,
              it.price || 0,
              it.preference || null,
              isoNow
            );
        } catch (itemErr) {
          console.warn("Could not insert order_item:", itemErr);
        }
      }

      const newOrder: OrderModel = {
        id: orderId,
        displayId,
        organizationId: org.organizationId,
        shortCode: org.shortCode,
        seat,
        locationName,
        locationId: locationId || undefined,
        employeeName,
        items,
        total,
        time,
        status,
        notes: notes || undefined,
        createdAt: isoNow,
        updatedAt: isoNow,
      };

      return c.json({ success: true, order: newOrder }, 201);
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // PATCH /api/orders/:id/status
  async updateStatus(c: Context<AppEnv>) {
    try {
      const id = c.req.param("id");
      const body = await c.req.json();
      const status = body.status || "Pending";
      const now = new Date().toISOString();
      const db = getUniversalDb(c.env?.DB);

      await db
        .prepare(`UPDATE orders SET status = ?, updated_at = ? WHERE id = ? OR display_id = ?`)
        .run(status, now, id, id);

      const updated = (await db.prepare(`SELECT * FROM orders WHERE id = ? OR display_id = ?`).bind(id, id).get()) as any;
      if (!updated) {
        return c.json({ success: false, message: "Order not found" }, 404);
      }

      let items: OrderItem[] = [];
      try {
        items = updated.items_json ? JSON.parse(updated.items_json) : [];
      } catch {}

      return c.json({
        success: true,
        order: {
          id: updated.id,
          displayId: updated.display_id || updated.id,
          organizationId: updated.organization_id,
          shortCode: updated.short_code,
          seat: updated.seat,
          locationName: updated.location_name,
          employeeName: updated.employee_name,
          items,
          total: Number(updated.total) || 0,
          time: updated.time,
          status: updated.status,
          notes: updated.notes || undefined,
          createdAt: updated.created_at,
          updatedAt: updated.updated_at,
        },
      });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // DELETE /api/orders/:id
  async deleteOrder(c: Context<AppEnv>) {
    try {
      const id = c.req.param("id");
      const db = getUniversalDb(c.env?.DB);

      const res = await db.prepare(`DELETE FROM orders WHERE id = ? OR display_id = ?`).bind(id, id).run();
      if (res.changes === 0) {
        return c.json({ success: false, message: "Order not found" }, 404);
      }

      // Clean up order_items
      await db.prepare(`DELETE FROM order_items WHERE order_id = ?`).bind(id).run();

      return c.json({ success: true, message: "Order removed" });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },
};
