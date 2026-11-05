import { Context } from "hono";
import { getUniversalDb } from "../db";
import { AppEnv } from "../types";
import { resolveAuthorizedOrg, getAuthUser } from "../middleware/auth.middleware";
import { getNextId, generateId } from "../utils/id-generator";
import { getSigningSecret, verifyTemporaryOrderToken } from "../utils/token";
import { validateOrderingWindow } from "../utils/session-window";

export interface OrderItem {
  id?: string;
  itemId?: string;
  name: string;
  qty: number;
  price: number;
  preference?: string;
  image?: string;
}

export interface OrderModel {
  id: string;
  displayId?: string;
  organizationId: string;
  shortCode: string;
  seat: string;
  seatId?: string;
  locationName: string;
  locationId?: string;
  employeeName: string;
  employeeId?: string;
  employeeEmail?: string;
  items: OrderItem[];
  subtotal?: number;
  adjustmentAmount?: number;
  discount?: number;
  total: number;
  time: string;
  status: "Pending" | "Preparing" | "Ready" | "Delivered" | "Canceled";
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export async function ensureOrderSchema(db: any): Promise<void> {
  try {
    await db.exec(`ALTER TABLE orders ADD COLUMN seat_id TEXT;`);
  } catch {}
  try {
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_orders_seat_id ON orders(seat_id);`);
  } catch {}
  try {
    await db.exec(`ALTER TABLE seats ADD COLUMN qr_token TEXT;`);
  } catch {}
  try {
    await db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_seats_qr_token ON seats(qr_token);`);
  } catch {}
}

export const orderController = {
  // GET /api/orders
  async getOrders(c: Context<AppEnv>) {
    try {
      const org = await resolveAuthorizedOrg(c);
      if (!org) {
        return c.json({ success: false, message: "Organization not found or access denied" }, 403);
      }

      const db = getUniversalDb(c.env?.DB);
      await ensureOrderSchema(db);
      const authUser = await getAuthUser(c);
      const location = c.req.query("location");
      const status = c.req.query("status");
      const employee = c.req.query("employee");
      const startDate = c.req.query("startDate");
      const endDate = c.req.query("endDate");

      let query = `
        SELECT DISTINCT
          o.id, 
          o.display_id as displayId,
          o.organization_id as organizationId, 
          o.short_code as shortCode,
          COALESCE(o.seat_id, o.seat) as seat,
          o.seat_id as seatId,
          o.location_id as locationId, 
          o.location_name as locationName,
          o.employee_name as employeeName, 
          o.employee_id as employeeId,
          u.email as employeeEmail,
          o.subtotal,
          o.adjustment_amount as adjustmentAmount,
          o.discount,
          o.total, 
          o.time, 
          o.status, 
          o.notes,
          o.items_json as itemsJson, 
          o.created_at as createdAt, 
          o.updated_at as updatedAt
        FROM orders o
        LEFT JOIN users u ON o.employee_id = u.id
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

      if (employee) {
        query += ` AND (o.employee_id = ? OR LOWER(o.employee_name) = LOWER(?) OR LOWER(u.email) = LOWER(?))`;
        params.push(employee, employee, employee);
      }

      if (startDate) {
        query += ` AND date(o.created_at) >= date(?)`;
        params.push(startDate.length >= 10 ? startDate.substring(0, 10) : startDate);
      }

      if (endDate) {
        query += ` AND date(o.created_at) <= date(?)`;
        params.push(endDate.length >= 10 ? endDate.substring(0, 10) : endDate);
      }

      query += ` ORDER BY o.created_at DESC`;

      const rows = (await db.prepare(query).bind(...params).all()) as any[];

      // Fetch normalized order_items for these orders if present
      const orders: OrderModel[] = await Promise.all(
        (rows || []).map(async (r) => {
          let items: OrderItem[] = [];
          try {
            const dbItems = (await db
              .prepare(`
                SELECT 
                  oi.id, 
                  oi.item_id as itemId, 
                  oi.name, 
                  oi.qty, 
                  oi.unit_price as price, 
                  oi.preference,
                  i.image as itemImage
                FROM order_items oi
                LEFT JOIN items i ON oi.item_id = i.id
                WHERE oi.order_id = ?
              `)
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
                image: di.itemImage || undefined,
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

          const rawTotal = Number(r.total) || 0;
          const subtotal = r.subtotal !== null && r.subtotal !== undefined
            ? Number(r.subtotal)
            : (items.length > 0 ? items.reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.qty) || 1), 0) : rawTotal);
          const adjustmentAmount = Number(r.adjustmentAmount) || 0;
          const discount = Number(r.discount) || 0;
          const total = r.subtotal !== null && r.subtotal !== undefined
            ? Math.max(0, subtotal + adjustmentAmount - discount)
            : rawTotal;

          return {
            id: r.id,
            displayId: r.displayId || r.id,
            organizationId: r.organizationId || org.organizationId,
            shortCode: r.shortCode || org.shortCode,
            seat: r.seatId || r.seat,
            seatId: r.seatId || undefined,
            locationId: r.locationId || undefined,
            locationName: r.locationName,
            employeeName: r.employeeName,
            employeeId: r.employeeId || undefined,
            employeeEmail: r.employeeEmail || undefined,
            items,
            subtotal,
            adjustmentAmount,
            discount,
            total,
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
      console.error("[orderController.getOrders] Error executing orders query:", err);
      return c.json({ success: false, message: err.message || "Failed to retrieve orders" }, 500);
    }
  },

  /**
   * GET /api/orders/employees
   * Returns a list of employees who have placed orders within the authorized organization
   * optionally filtered by startDate and endDate.
   */
  async getOrderEmployees(c: Context<AppEnv>) {
    try {
      const org = await resolveAuthorizedOrg(c);
      if (!org) {
        return c.json({ success: false, message: "Organization not found" }, 403);
      }

      const db = getUniversalDb(c.env?.DB);
      const startDate = c.req.query("startDate");
      const endDate = c.req.query("endDate");

      let query = `
        SELECT 
          COALESCE(o.employee_id, '') as employeeId,
          o.employee_name as employeeName,
          u.email as employeeEmail,
          o.location_name as locationName,
          o.seat as seat,
          COUNT(o.id) as orderCount,
          SUM(o.total) as totalSpend,
          MAX(o.created_at) as latestOrderDate
        FROM orders o
        LEFT JOIN users u ON o.employee_id = u.id
        WHERE o.organization_id = ?
      `;
      const params: any[] = [org.organizationId];

      if (startDate) {
        query += ` AND date(o.created_at) >= date(?)`;
        params.push(startDate.length >= 10 ? startDate.substring(0, 10) : startDate);
      }
      if (endDate) {
        query += ` AND date(o.created_at) <= date(?)`;
        params.push(endDate.length >= 10 ? endDate.substring(0, 10) : endDate);
      }

      query += `
        GROUP BY COALESCE(o.employee_id, o.employee_name), o.employee_name
        ORDER BY MAX(o.created_at) DESC
      `;

      const rows = (await db.prepare(query).bind(...params).all()) as any[];

      const employees = (rows || []).map((r) => ({
        employeeId: r.employeeId || null,
        employeeName: r.employeeName,
        employeeEmail: r.employeeEmail || null,
        department: r.locationName || "Office Team",
        locationName: r.locationName || "Office",
        seat: r.seat ? `Seat ${r.seat}` : "",
        orderCount: Number(r.orderCount) || 0,
        totalSpend: Number(r.totalSpend) || 0,
        latestOrderDate: r.latestOrderDate,
      }));

      return c.json({ success: true, employees });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  /**
   * GET /api/orders/locations
   * Returns all locations belonging to the authorized organization with aggregated order statistics.
   * Supports optional date filters: ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
   */
  async getOrderLocations(c: Context<AppEnv>) {
    try {
      const org = await resolveAuthorizedOrg(c);
      if (!org) {
        return c.json({ success: false, message: "Organization not found" }, 403);
      }

      const db = getUniversalDb(c.env?.DB);
      await ensureOrderSchema(db);
      const authUser = await getAuthUser(c);
      const startDate = c.req.query("startDate");
      const endDate = c.req.query("endDate");

      // 1. Fetch locations for the organization (respecting provider scoping if applicable)
      let locQuery = `
        SELECT l.id, l.name, l.total_seats as totalSeats, l.status, l.created_at as createdAt
        FROM locations l
      `;
      const locParams: any[] = [];

      if (authUser?.userType === "Provider") {
        locQuery += `
          LEFT JOIN provider_locations pl ON l.id = pl.location_id
          WHERE l.organization_id = ? AND (l.assigned_provider_id = ? OR pl.provider_id = ?)
        `;
        locParams.push(org.organizationId, authUser.id, authUser.id);
      } else {
        locQuery += ` WHERE l.organization_id = ?`;
        locParams.push(org.organizationId);
      }
      locQuery += ` ORDER BY l.name ASC`;

      const locations = (await db.prepare(locQuery).bind(...locParams).all()) as any[];

      // 2. Fetch order statistics grouped by location_id and location_name
      let statsQuery = `
        SELECT 
          o.location_id as locationId,
          LOWER(o.location_name) as locNameLower,
          COUNT(o.id) as totalOrders,
          COALESCE(SUM(o.total), 0) as totalAmount,
          SUM(CASE WHEN LOWER(o.status) = 'pending' THEN 1 ELSE 0 END) as pendingOrders,
          SUM(CASE WHEN LOWER(o.status) = 'delivered' THEN 1 ELSE 0 END) as deliveredOrders
        FROM orders o
        WHERE o.organization_id = ?
      `;
      const statsParams: any[] = [org.organizationId];

      if (startDate) {
        statsQuery += ` AND date(o.created_at) >= date(?)`;
        statsParams.push(startDate.length >= 10 ? startDate.substring(0, 10) : startDate);
      }
      if (endDate) {
        statsQuery += ` AND date(o.created_at) <= date(?)`;
        statsParams.push(endDate.length >= 10 ? endDate.substring(0, 10) : endDate);
      }

      statsQuery += ` GROUP BY o.location_id, LOWER(o.location_name)`;
      const statsRows = (await db.prepare(statsQuery).bind(...statsParams).all()) as any[];

      // 3. Count assigned employees per location
      const assignedRows = (await db
        .prepare(
          `SELECT location_id as locationId, COUNT(DISTINCT COALESCE(employee_id, employee)) as assignedCount
           FROM seats
           WHERE organization_id = ? AND (employee_id IS NOT NULL OR employee IS NOT NULL)
           GROUP BY location_id`
        )
        .bind(org.organizationId)
        .all()) as any[];

      const assignedMap = new Map<string, number>();
      for (const a of assignedRows || []) {
        if (a.locationId) assignedMap.set(a.locationId, Number(a.assignedCount) || 0);
      }

      // Merge results
      const results = (locations || []).map((loc) => {
        // Find matching stats either by locationId or lower(name)
        const stat = (statsRows || []).find(
          (s) => s.locationId === loc.id || (s.locNameLower && s.locNameLower === (loc.name || "").toLowerCase())
        );

        return {
          id: loc.id,
          name: loc.name,
          locationType: "Office / Dining Area",
          totalSeats: loc.totalSeats || 0,
          totalEmployees: assignedMap.get(loc.id) || 0,
          totalOrders: stat ? Number(stat.totalOrders) : 0,
          totalAmount: stat ? Number(stat.totalAmount) : 0,
          pendingOrders: stat ? Number(stat.pendingOrders) : 0,
          deliveredOrders: stat ? Number(stat.deliveredOrders) : 0,
          status: loc.status || "Active",
        };
      });

      return c.json({ success: true, locations: results });
    } catch (err: any) {
      console.error("[orderController.getOrderLocations] Error:", err);
      return c.json({ success: false, message: err.message || "Failed to retrieve location order summaries" }, 500);
    }
  },

  /**
   * GET /api/orders/location/:locationId/employees
   * Returns employees assigned to or ordering in a specific location with order summaries.
   * Supports optional date filters: ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
   */
  async getLocationEmployees(c: Context<AppEnv>) {
    try {
      const org = await resolveAuthorizedOrg(c);
      if (!org) {
        return c.json({ success: false, message: "Organization not found" }, 403);
      }

      const locationId = c.req.param("locationId");
      const db = getUniversalDb(c.env?.DB);
      await ensureOrderSchema(db);
      const startDate = c.req.query("startDate");
      const endDate = c.req.query("endDate");

      // Verify location belongs to organization
      const loc = (await db
        .prepare(`SELECT id, name FROM locations WHERE (id = ? OR display_id = ? OR LOWER(name) = LOWER(?)) AND organization_id = ?`)
        .bind(locationId, locationId, locationId, org.organizationId)
        .get()) as any;

      if (!loc) {
        return c.json({ success: false, message: "Location not found" }, 404);
      }

      const effectiveLocId = loc.id;

      // 1. Get all seats in this location and their assigned employees
      const seats = (await db
        .prepare(
          `SELECT 
             s.id as seatId, 
             s.display_id as seatDisplayId,
             s.number as seatNumber, 
             s.employee_id as employeeId, 
             s.employee_name as employeeName, 
             s.employee_email as employeeEmail, 
             s.employee as employeeRaw,
             u.id as userId,
             u.name as uName,
             u.user_name as userName,
             u.email as uEmail
           FROM seats s
           LEFT JOIN users u ON s.employee_id = u.id
           WHERE s.location_id = ? AND s.organization_id = ?`
        )
        .bind(effectiveLocId, org.organizationId)
        .all()) as any[];

      // 2. Query order aggregates for this location
      let orderQuery = `
        SELECT 
          o.id,
          o.seat_id as seatId,
          o.seat as seat,
          o.employee_id as employeeId,
          o.employee_name as employeeName,
          o.total,
          o.status,
          o.created_at as createdAt
        FROM orders o
        WHERE o.organization_id = ? AND (o.location_id = ? OR LOWER(o.location_name) = LOWER(?))
      `;
      const orderParams: any[] = [org.organizationId, effectiveLocId, loc.name];

      if (startDate) {
        orderQuery += ` AND date(o.created_at) >= date(?)`;
        orderParams.push(startDate.length >= 10 ? startDate.substring(0, 10) : startDate);
      }
      if (endDate) {
        orderQuery += ` AND date(o.created_at) <= date(?)`;
        orderParams.push(endDate.length >= 10 ? endDate.substring(0, 10) : endDate);
      }

      orderQuery += ` ORDER BY o.created_at DESC`;
      let locOrders: any[] = [];
      try {
        locOrders = (await db.prepare(orderQuery).bind(...orderParams).all()) as any[];
      } catch (err: any) {
        // Fallback if seat_id is missing on old D1 database instances
        if (String(err?.message || "").includes("seat_id")) {
          const fallbackQuery = orderQuery.replace("o.seat_id as seatId,\n          o.seat as seat,", "o.seat as seatId,\n          o.seat as seat,");
          locOrders = (await db.prepare(fallbackQuery).bind(...orderParams).all()) as any[];
        } else {
          throw err;
        }
      }

      // 3. Build comprehensive employee list for this location:
      // Include all seats assigned to employees in this location, plus any employees with orders in this location.
      interface LocEmpSummary {
        employeeId: string;
        employeeName: string;
        username?: string;
        employeeEmail?: string;
        seat: string;
        seatId?: string;
        totalOrders: number;
        totalAmount: number;
        latestStatus?: string;
        latestOrderDate?: string;
      }

      const empMap = new Map<string, LocEmpSummary>();

      // First add assigned seats
      for (const s of seats || []) {
        const empName = s.uName || s.employeeName || s.employeeRaw;
        const empId = s.userId || s.employeeId;
        const seatLabel = s.seatId || (s.seatNumber ? `Seat ${s.seatNumber}` : "Seat");

        if (empName || empId) {
          const key = empId || empName;
          empMap.set(key, {
            employeeId: empId || `emp_${key}`,
            employeeName: empName || "Assigned Employee",
            username: s.userName || undefined,
            employeeEmail: s.uEmail || s.employeeEmail || undefined,
            seat: seatLabel,
            seatId: s.seatId,
            totalOrders: 0,
            totalAmount: 0,
            latestStatus: "None",
            latestOrderDate: undefined,
          });
        }
      }

      // Now aggregate orders into employee summaries
      for (const o of locOrders || []) {
        const oEmpKey = o.employeeId || o.employeeName;
        if (!oEmpKey) continue;

        let existing = empMap.get(oEmpKey);
        if (!existing) {
          // If employee placed order in this location but not assigned to a seat
          existing = {
            employeeId: o.employeeId || `emp_${o.employeeName}`,
            employeeName: o.employeeName || "Employee",
            seat: o.seatId || o.seat || "Seat",
            seatId: o.seatId || undefined,
            totalOrders: 0,
            totalAmount: 0,
            latestStatus: undefined,
            latestOrderDate: undefined,
          };
          empMap.set(oEmpKey, existing);
        }

        existing.totalOrders += 1;
        existing.totalAmount += Number(o.total) || 0;
        if (!existing.latestOrderDate || new Date(o.createdAt) > new Date(existing.latestOrderDate)) {
          existing.latestOrderDate = o.createdAt;
          existing.latestStatus = o.status;
        }
      }

      // Convert to array and sort by totalOrders desc, then employeeName
      const employeeList = Array.from(empMap.values()).sort((a, b) => {
        if (b.totalOrders !== a.totalOrders) return b.totalOrders - a.totalOrders;
        return a.employeeName.localeCompare(b.employeeName);
      });

      return c.json({
        success: true,
        location: {
          id: loc.id,
          name: loc.name,
        },
        employees: employeeList,
      });
    } catch (err: any) {
      console.error("[orderController.getLocationEmployees] Error:", err);
      return c.json({ success: false, message: err.message || "Failed to retrieve location employees" }, 500);
    }
  },

  /**
   * GET /api/orders/employee/:employeeId
   * Returns employee profile info, summary metrics, and their list of individual orders.
   * Supports optional date filters: ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
   */
  async getEmployeeOrders(c: Context<AppEnv>) {
    try {
      const org = await resolveAuthorizedOrg(c);
      if (!org) {
        return c.json({ success: false, message: "Organization not found" }, 403);
      }

      const employeeId = c.req.param("employeeId");
      const db = getUniversalDb(c.env?.DB);
      await ensureOrderSchema(db);
      const startDate = c.req.query("startDate");
      const endDate = c.req.query("endDate");

      // 1. Resolve employee user record if exists
      const user = (await db
        .prepare(
          `SELECT u.id, u.name, u.user_name as userName, u.email
           FROM users u
           JOIN user_organizations uo ON u.id = uo.user_id
           WHERE uo.organization_id = ? AND (u.id = ? OR LOWER(u.name) = LOWER(?) OR LOWER(u.email) = LOWER(?))`
        )
        .bind(org.organizationId, employeeId, employeeId, employeeId)
        .get()) as any;

      // 2. Resolve employee's assigned seat (if any)
      let assignedSeat: any = null;
      try {
        assignedSeat = await db
          .prepare(
            `SELECT s.id as seatId, s.display_id as seatDisplayId, s.number as seatNumber, l.id as locationId, l.name as locationName
             FROM seats s
             JOIN locations l ON s.location_id = l.id
             WHERE s.organization_id = ? AND (s.employee_id = ? OR LOWER(s.employee_name) = LOWER(?) OR LOWER(s.employee) = LOWER(?))
             LIMIT 1`
          )
          .bind(org.organizationId, user?.id || employeeId, user?.name || employeeId, user?.name || employeeId)
          .get();
      } catch {}

      // 3. Query all orders placed by this employee in this organization
      let orderQuery = `
        SELECT 
          o.id, 
          o.display_id as displayId,
          o.seat_id as seatId, 
          o.seat as seat,
          o.location_id as locationId, 
          o.location_name as locationName,
          o.employee_name as employeeName, 
          o.employee_id as employeeId,
          o.subtotal,
          o.adjustment_amount as adjustmentAmount,
          o.discount,
          o.total, 
          o.time, 
          o.status, 
          o.notes,
          o.items_json as itemsJson, 
          o.created_at as createdAt, 
          o.updated_at as updatedAt
        FROM orders o
        WHERE o.organization_id = ?
          AND (o.employee_id = ? OR (o.employee_name IS NOT NULL AND LOWER(o.employee_name) = LOWER(?)))
      `;
      const resolvedName = user?.name || employeeId;
      const orderParams: any[] = [org.organizationId, user?.id || employeeId, resolvedName];

      if (startDate) {
        orderQuery += ` AND date(o.created_at) >= date(?)`;
        orderParams.push(startDate.length >= 10 ? startDate.substring(0, 10) : startDate);
      }
      if (endDate) {
        orderQuery += ` AND date(o.created_at) <= date(?)`;
        orderParams.push(endDate.length >= 10 ? endDate.substring(0, 10) : endDate);
      }

      orderQuery += ` ORDER BY o.created_at DESC`;
      let rows: any[] = [];
      try {
        rows = (await db.prepare(orderQuery).bind(...orderParams).all()) as any[];
      } catch (err: any) {
        if (String(err?.message || "").includes("seat_id")) {
          const fallbackQuery = orderQuery.replace("o.seat_id as seatId,\n          o.seat as seat,", "o.seat as seatId,\n          o.seat as seat,");
          rows = (await db.prepare(fallbackQuery).bind(...orderParams).all()) as any[];
        } else {
          throw err;
        }
      }

      // Fetch normalized order_items for each order
      const orders = await Promise.all(
        (rows || []).map(async (r) => {
          let items: OrderItem[] = [];
          try {
            const dbItems = (await db
              .prepare(
                `SELECT 
                   oi.id, 
                   oi.item_id as itemId, 
                   oi.name, 
                   oi.qty, 
                   oi.unit_price as price, 
                   oi.preference,
                   i.image as itemImage
                 FROM order_items oi
                 LEFT JOIN items i ON oi.item_id = i.id
                 WHERE oi.order_id = ?`
              )
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
                image: di.itemImage || undefined,
              }));
            } else if (r.itemsJson) {
              items = JSON.parse(r.itemsJson);
            }
          } catch {
            if (r.itemsJson) {
              try { items = JSON.parse(r.itemsJson); } catch {}
            }
          }

          const rawTotal = Number(r.total) || 0;
          const subtotal = r.subtotal !== null && r.subtotal !== undefined
            ? Number(r.subtotal)
            : (items.length > 0 ? items.reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.qty) || 1), 0) : rawTotal);
          const adjustmentAmount = Number(r.adjustmentAmount) || 0;
          const discount = Number(r.discount) || 0;
          const total = r.subtotal !== null && r.subtotal !== undefined
            ? Math.max(0, subtotal + adjustmentAmount - discount)
            : rawTotal;

          return {
            id: r.id,
            displayId: r.displayId || r.id,
            seat: r.seatId || r.seat,
            seatId: r.seatId || undefined,
            locationId: r.locationId || undefined,
            locationName: r.locationName,
            employeeName: r.employeeName,
            employeeId: r.employeeId || undefined,
            items,
            subtotal,
            adjustmentAmount,
            discount,
            total,
            time: r.time,
            status: r.status,
            notes: r.notes || undefined,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
          };
        })
      );

      // Compute statistics
      const totalOrders = orders.length;
      const totalSpend = orders.reduce((sum, o) => sum + (o.total || 0), 0);
      const pendingOrders = orders.filter((o) => o.status?.toLowerCase() === "pending").length;
      const deliveredOrders = orders.filter((o) => o.status?.toLowerCase() === "delivered").length;
      const cancelledOrders = orders.filter((o) => o.status?.toLowerCase() === "cancelled" || o.status?.toLowerCase() === "canceled").length;

      const primaryLocation = assignedSeat?.locationName || (orders[0]?.locationName || "Office");
      const primarySeat = assignedSeat?.seatId || (orders[0]?.seat || "Seat 01");

      return c.json({
        success: true,
        employee: {
          id: user?.id || employeeId,
          name: user?.name || orders[0]?.employeeName || employeeId,
          username: user?.userName || undefined,
          email: user?.email || undefined,
          locationName: primaryLocation,
          seatIdentifier: primarySeat,
          totalOrders,
          totalSpend,
          pendingOrders,
          deliveredOrders,
          cancelledOrders,
        },
        orders,
      });
    } catch (err: any) {
      console.error("[orderController.getEmployeeOrders] Error:", err);
      return c.json({ success: false, message: err.message || "Failed to retrieve employee orders" }, 500);
    }
  },
  async getOrderById(c: Context<AppEnv>) {
    try {
      const id = c.req.param("id");
      const db = getUniversalDb(c.env?.DB);

      const row = (await db
        .prepare(
          `SELECT 
            id, display_id as displayId, organization_id as organizationId, short_code as shortCode,
            seat, seat_id as seatId, location_id as locationId, location_name as locationName,
            employee_name as employeeName, subtotal, adjustment_amount as adjustmentAmount, discount,
            total, time, status, notes,
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
          .prepare(`
            SELECT 
              oi.id, 
              oi.item_id as itemId, 
              oi.name, 
              oi.qty, 
              oi.unit_price as price, 
              oi.preference,
              i.image as itemImage
            FROM order_items oi
            LEFT JOIN items i ON oi.item_id = i.id
            WHERE oi.order_id = ?
          `)
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
            image: di.itemImage || undefined,
          }));
        } else if (row.itemsJson) {
          items = JSON.parse(row.itemsJson);
        }
      } catch {}

      const rawTotal = Number(row.total) || 0;
      const subtotal = row.subtotal !== null && row.subtotal !== undefined
        ? Number(row.subtotal)
        : (items.length > 0 ? items.reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.qty) || 1), 0) : rawTotal);
      const adjustmentAmount = Number(row.adjustmentAmount) || 0;
      const discount = Number(row.discount) || 0;
      const total = row.subtotal !== null && row.subtotal !== undefined
        ? Math.max(0, subtotal + adjustmentAmount - discount)
        : rawTotal;

      return c.json({
        success: true,
        order: {
          id: row.id,
          displayId: row.displayId || row.id,
          organizationId: row.organizationId,
          shortCode: row.shortCode,
          seat: row.seatId || row.seat,
          seatId: row.seatId || undefined,
          locationId: row.locationId || undefined,
          locationName: row.locationName,
          employeeName: row.employeeName,
          items,
          subtotal,
          adjustmentAmount,
          discount,
          total,
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

      // Generate sequential order ID e.g. ORD-0001 (authoritative from D1 sequence)
      const { displayId } = await getNextId(db, "ORD", org.shortCode);
      const orderId = displayId;

      let employeeId: string | null = null;
      let employeeName = body.employeeName || "Guest";
      let validatedSeatNumber = body.seat ? String(body.seat).padStart(2, "0") : "";
      let validatedSeatId: string | null = body.seatId || (body.seat && String(body.seat).includes('-') ? String(body.seat) : null);
      let validatedLocationId = body.locationId || null;
      let validatedLocationName = body.locationName || "Office";

      const qrToken = body.qrToken ? String(body.qrToken).trim() : null;
      const tempSessionToken = body.tempSessionToken ? String(body.tempSessionToken).trim() : null;

      // Check if order is being created by an authorized Admin or Provider (e.g. manual entry)
      const authUser = await getAuthUser(c);
      const isPrivilegedStaff = authUser?.userType === "Admin" || authUser?.userType === "Provider";

      // Every order from non-staff must be backed by a verified temporary session (or legacy permanent token)
      if (!isPrivilegedStaff && !tempSessionToken && !qrToken) {
        return c.json(
          {
            success: false,
            message: "An active ordering session is required. Please scan your QR code to place an order.",
          },
          401
        );
      }

      // Validate ordering window / schedule on backend
      const windowCheck = await validateOrderingWindow(db, org.organizationId, { isPrivilegedStaff });
      if (!windowCheck.allowed) {
        return c.json(
          {
            success: false,
            message: windowCheck.reason || "Orders cannot be placed outside configured ordering hours.",
            windowStatus: windowCheck,
          },
          403
        );
      }

      // ── 1. Validate temporary session token (Stateless JWT or Legacy DB) ──
      if (tempSessionToken && tempSessionToken.includes(".")) {
        // Stateless signed JWT token validation
        const secret = getSigningSecret(c.env);
        const verifyRes = await verifyTemporaryOrderToken(tempSessionToken, secret);

        if (!verifyRes.valid) {
          if (verifyRes.reason === "expired") {
            return c.json(
              {
                success: false,
                message: "Your ordering session has expired. Please scan your QR code again to start a new session.",
              },
              410
            );
          }
          return c.json(
            {
              success: false,
              message: "Invalid or tampered temporary ordering token.",
            },
            401
          );
        }

        const payload = verifyRes.payload;

        // Ensure token belongs to the authorized organization context
        if (payload.orgId !== org.organizationId) {
          return c.json(
            {
              success: false,
              message: "Temporary token does not belong to the requested organization.",
            },
            403
          );
        }

        // Check if employee permanent credential is still active (if bound to employee)
        if (payload.empId) {
          const empRow = (await db
            .prepare(
              `SELECT u.id, u.name, u.email, u.qr_token_status as qrTokenStatus, u.perm_token_status as permTokenStatus
               FROM users u
               JOIN user_organizations uo ON u.id = uo.user_id
               WHERE u.id = ? AND uo.organization_id = ?`
            )
            .bind(payload.empId, org.organizationId)
            .get()) as any;

          if (!empRow) {
            return c.json({ success: false, message: "Assigned employee not found in this organization." }, 403);
          }

          const legacyRevoked = empRow.qrTokenStatus && empRow.qrTokenStatus !== "active";
          const newRevoked = empRow.permTokenStatus && empRow.permTokenStatus !== "active";
          if (legacyRevoked || newRevoked) {
            return c.json({ success: false, message: "Employee QR credential has been revoked." }, 403);
          }

          employeeId = String(empRow.id);
          employeeName = empRow.name || empRow.email || employeeName;
        }

        // Authoritatively lock seat and location from the signed token payload
        if (payload.seatId) {
          validatedSeatId = payload.seatId;
        }
        if (payload.seatNo) {
          validatedSeatNumber = String(payload.seatNo).padStart(2, "0");
        }
        if (payload.locId) {
          validatedLocationId = payload.locId;
          const locRow = (await db
            .prepare(`SELECT name FROM locations WHERE id = ? AND organization_id = ?`)
            .bind(payload.locId, org.organizationId)
            .get()) as any;
          if (locRow) validatedLocationName = locRow.name;
        }
        if (payload.empName && (!employeeName || employeeName === "Guest")) {
          employeeName = payload.empName;
        }

      // ── 2. Legacy: validate permanent qr_token (backward compat) ─────────
      } else if (qrToken) {
        const tokenUser = (await db
          .prepare(
            `SELECT u.id, u.name, u.email, u.qr_token_status, uo.organization_id, o.short_code
             FROM users u
             JOIN user_organizations uo ON u.id = uo.user_id
             JOIN organizations o ON uo.organization_id = o.id
             WHERE u.qr_token = ?`
          )
          .bind(qrToken)
          .get()) as any;

        if (!tokenUser) {
          return c.json({ success: false, message: "Invalid employee QR token" }, 403);
        }
        if (tokenUser.qr_token_status !== "active") {
          return c.json({ success: false, message: "This employee QR token has been revoked" }, 403);
        }

        if (tokenUser.organization_id !== org.organizationId) {
          return c.json({ success: false, message: "Token does not belong to this organization" }, 403);
        }

        employeeId = String(tokenUser.id);
        employeeName = tokenUser.name || tokenUser.email || employeeName;
      }

      // If location and seat are known, authoritatively verify against database seats
      if (validatedLocationId && (validatedSeatId || validatedSeatNumber)) {
        try {
          const dbSeat = (await db
            .prepare(
              `SELECT id, display_id as displayId, number, employee_id as employeeId, employee_name as employeeName 
               FROM seats 
               WHERE location_id = ? AND (id = ? OR number = ? OR display_id = ?)`
            )
            .bind(validatedLocationId, validatedSeatId || validatedSeatNumber, validatedSeatNumber, validatedSeatId || validatedSeatNumber)
            .get()) as any;

          if (dbSeat) {
            validatedSeatId = dbSeat.id;
            if (!validatedSeatNumber && dbSeat.number) validatedSeatNumber = dbSeat.number;
            if ((!employeeName || employeeName === "Guest") && dbSeat.employeeName) {
              employeeName = dbSeat.employeeName;
            }
            if (!employeeId && dbSeat.employeeId) {
              employeeId = dbSeat.employeeId;
            }
          }
        } catch {}
      }

      const seat = validatedSeatId || validatedSeatNumber || "01";
      const seatId = validatedSeatId || seat;
      const locationName = validatedLocationName;
      const locationId = validatedLocationId;
      const items = Array.isArray(body.items) ? body.items : [];

      if (items.length === 0) {
        return c.json({ success: false, message: "Order must contain at least one item" }, 400);
      }

      // Backend validation: Verify menu items against DB records and calculate authoritative subtotal
      let calculatedSubtotal = 0;

      for (const it of items) {
        let dbItem: any = null;
        if (it.itemId) {
          dbItem = (await db
            .prepare(`SELECT id, name, type, category, preference, amount, status FROM items WHERE id = ? AND organization_id = ?`)
            .bind(it.itemId, org.organizationId)
            .get()) as any;
        }
        if (!dbItem && it.name) {
          const rawName = String(it.name).trim();
          const cleanName = rawName.replace(/\s*\(.*?\)\s*$/, "").trim();
          dbItem = (await db
            .prepare(`SELECT id, name, type, category, preference, amount, status FROM items WHERE organization_id = ? AND (LOWER(name) = LOWER(?) OR LOWER(name) = LOWER(?)) LIMIT 1`)
            .bind(org.organizationId, rawName, cleanName)
            .get()) as any;
        }

        if (dbItem && dbItem.status === "Out of Stock") {
          return c.json({ success: false, message: `Item '${dbItem.name}' is currently out of stock.` }, 400);
        }

        const isBeverage = dbItem
          ? (dbItem.type === "Beverages" || dbItem.category === "Beverages")
          : (it.category === "Beverages" || (it.name && /(tea|coffee|chai|drink|juice|latte|cappuccino)/i.test(it.name)));

        if (isBeverage) {
          let prefValue = it.preference ? String(it.preference).trim() : "";
          if (!prefValue && it.name && it.name.includes("(") && it.name.includes(")")) {
            const match = it.name.match(/\((.*?)\)/);
            if (match && match[1]) {
              prefValue = match[1].trim();
            }
          }

          if (!prefValue) {
            const itemName = dbItem?.name || it.name || "Beverage";
            return c.json({
              success: false,
              message: `Please select a sugar preference for ${itemName}.`,
            }, 400);
          }

          const validPrefs = ["no", "low", "medium", "high"];
          if (!validPrefs.includes(prefValue.toLowerCase())) {
            const itemName = dbItem?.name || it.name || "Beverage";
            return c.json({
              success: false,
              message: `Invalid preference '${prefValue}' for ${itemName}. Must be No, Low, Medium, or High.`,
            }, 400);
          }
        }

        // Authoritative item price from database if available
        const itemQty = Math.max(1, parseInt(it.qty, 10) || 1);
        const itemPrice = dbItem?.amount !== undefined && dbItem?.amount !== null
          ? Number(dbItem.amount)
          : (Number(it.price) || 0);

        it.price = itemPrice;
        it.qty = itemQty;
      }

      const rawClientTotal = Number(body.total) || 0;
      const time = body.time && body.time !== "Just now"
        ? body.time
        : now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
      const status = "Pending";
      const notes = body.notes || null;
      const itemsJson = JSON.stringify(items);
      const isoNow = now.toISOString();

      const subtotal = calculatedSubtotal > 0
        ? calculatedSubtotal
        : (body.subtotal !== undefined ? Number(body.subtotal) : rawClientTotal);
      const adjustmentAmount = Number(body.adjustmentAmount) || 0;
      const discount = Number(body.discount) || 0;
      const calculatedTotal = Math.max(0, subtotal + adjustmentAmount - discount);

      await db
        .prepare(
          `INSERT INTO orders (
            id, display_id, organization_id, short_code, seat, seat_id, location_id, location_name,
            employee_name, employee_id, qr_token, subtotal, adjustment_amount, discount, total, time, status, notes, items_json,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          orderId,
          displayId,
          org.organizationId,
          org.shortCode,
          seat,
          seatId,
          locationId,
          locationName,
          employeeName,
          employeeId,
          qrToken,
          subtotal,
          adjustmentAmount,
          discount,
          calculatedTotal,
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
        const oiId = await generateId(db, "OIT");
        let resolvedItemId = it.itemId || null;

        // If itemId was not provided in payload, attempt exact match from items in this organization
        if (!resolvedItemId && it.name) {
          try {
            const rawName = String(it.name).trim();
            const cleanName = rawName.replace(/\s*\(.*?\)\s*$/, "").trim();
            const foundItem = (await db
              .prepare(
                `SELECT id FROM items 
                 WHERE organization_id = ? 
                   AND (LOWER(name) = LOWER(?) OR LOWER(name) = LOWER(?)) 
                 LIMIT 1`
              )
              .bind(org.organizationId, rawName, cleanName)
              .get()) as any;

            if (foundItem && foundItem.id) {
              resolvedItemId = foundItem.id;
            }
          } catch {}
        }

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
              resolvedItemId,
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
        subtotal,
        adjustmentAmount,
        discount,
        total: calculatedTotal,
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

      const rawTotal = Number(updated.total) || 0;
      const subtotal = updated.subtotal !== null && updated.subtotal !== undefined
        ? Number(updated.subtotal)
        : (items.length > 0 ? items.reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.qty) || 1), 0) : rawTotal);
      const adjustmentAmount = Number(updated.adjustment_amount) || 0;
      const discount = Number(updated.discount) || 0;
      const total = updated.subtotal !== null && updated.subtotal !== undefined
        ? Math.max(0, subtotal + adjustmentAmount - discount)
        : rawTotal;

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
          subtotal,
          adjustmentAmount,
          discount,
          total,
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

  // PUT /api/orders/:id (Update order details, adjustment amount, discount, seat, notes, status)
  async updateOrder(c: Context<AppEnv>) {
    try {
      const id = c.req.param("id");
      const body = await c.req.json();
      const db = getUniversalDb(c.env?.DB);

      const existing = (await db.prepare(`SELECT * FROM orders WHERE id = ? OR display_id = ?`).bind(id, id).get()) as any;
      if (!existing) {
        return c.json({ success: false, message: "Order not found" }, 404);
      }

      let items: OrderItem[] = [];
      try {
        items = existing.items_json ? JSON.parse(existing.items_json) : [];
      } catch {}
      if (Array.isArray(body.items)) {
        items = body.items;
      }

      const rawExistingTotal = Number(existing.total) || 0;
      const calculatedSubtotal = items.length > 0
        ? items.reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.qty) || 1), 0)
        : rawExistingTotal;

      const subtotal = body.subtotal !== undefined ? Number(body.subtotal) : (existing.subtotal !== null ? Number(existing.subtotal) : calculatedSubtotal);
      const adjustmentAmount = body.adjustmentAmount !== undefined ? Number(body.adjustmentAmount) : (Number(existing.adjustment_amount) || 0);
      const discount = body.discount !== undefined ? Number(body.discount) : (Number(existing.discount) || 0);
      const total = Math.max(0, subtotal + adjustmentAmount - discount);

      const status = body.status !== undefined ? body.status : existing.status;
      const seat = body.seat !== undefined ? String(body.seat).padStart(2, "0") : existing.seat;
      const notes = body.notes !== undefined ? body.notes : existing.notes;
      const employeeName = body.employeeName !== undefined ? body.employeeName : existing.employee_name;
      const itemsJson = Array.isArray(body.items) ? JSON.stringify(body.items) : existing.items_json;
      const now = new Date().toISOString();

      await db
        .prepare(
          `UPDATE orders SET 
            subtotal = ?, adjustment_amount = ?, discount = ?, total = ?, 
            status = ?, seat = ?, notes = ?, employee_name = ?, items_json = ?, updated_at = ?
           WHERE id = ? OR display_id = ?`
        )
        .run(subtotal, adjustmentAmount, discount, total, status, seat, notes, employeeName, itemsJson, now, id, id);

      return c.json({
        success: true,
        order: {
          id: existing.id,
          displayId: existing.display_id || existing.id,
          organizationId: existing.organization_id,
          shortCode: existing.short_code,
          seat,
          locationName: existing.location_name,
          employeeName,
          items,
          subtotal,
          adjustmentAmount,
          discount,
          total,
          time: existing.time,
          status,
          notes: notes || undefined,
          createdAt: existing.created_at,
          updatedAt: now,
        },
      });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // POST /api/orders/bulk-status (Bulk update order statuses: Delivered or Canceled)
  async bulkUpdateStatus(c: Context<AppEnv>) {
    try {
      const org = await resolveAuthorizedOrg(c);
      if (!org) {
        return c.json({ success: false, message: "Organization not found" }, 403);
      }

      const body = await c.req.json();
      const orderIds: string[] = Array.isArray(body.orderIds) ? body.orderIds : [];
      const nextStatus = body.status;

      if (!orderIds || orderIds.length === 0) {
        return c.json({ success: false, message: "No order IDs provided" }, 400);
      }
      if (!nextStatus || !["Delivered", "Canceled", "Preparing", "Ready"].includes(nextStatus)) {
        return c.json({ success: false, message: "Invalid target status" }, 400);
      }

      const db = getUniversalDb(c.env?.DB);
      const authUser = await getAuthUser(c);
      const now = new Date().toISOString();

      // Only allow updating pending/active orders
      let updatedCount = 0;
      for (const oid of orderIds) {
        // Enforce org isolation and provider assigned location verification
        let checkQuery = `SELECT o.id, o.status FROM orders o WHERE (o.id = ? OR o.display_id = ?) AND o.organization_id = ?`;
        const params: any[] = [oid, oid, org.organizationId];

        if (authUser?.userType === "Provider") {
          checkQuery = `
            SELECT o.id, o.status 
            FROM orders o
            LEFT JOIN locations loc ON o.location_id = loc.id
            LEFT JOIN provider_locations pl ON o.location_id = pl.location_id
            WHERE (o.id = ? OR o.display_id = ?) AND o.organization_id = ?
              AND (loc.assigned_provider_id = ? OR pl.provider_id = ?)
          `;
          params.push(authUser.id, authUser.id);
        }

        const orderRow = (await db.prepare(checkQuery).bind(...params).get()) as any;
        if (orderRow && orderRow.status !== "Delivered" && orderRow.status !== "Canceled") {
          await db
            .prepare(`UPDATE orders SET status = ?, updated_at = ? WHERE id = ?`)
            .run(nextStatus, now, orderRow.id);
          updatedCount++;
        }
      }

      return c.json({
        success: true,
        message: `Successfully updated ${updatedCount} orders to ${nextStatus}`,
        updatedCount,
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
