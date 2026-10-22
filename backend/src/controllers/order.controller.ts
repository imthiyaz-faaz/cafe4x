import { Context } from "hono";
import { getUniversalDb } from "../db";
import { AppEnv } from "../types";
import { resolveAuthorizedOrg, getAuthUser } from "../middleware/auth.middleware";
import { getNextId } from "../utils/id-generator";
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

export const orderController = {
  // GET /api/orders
  async getOrders(c: Context<AppEnv>) {
    try {
      const org = await resolveAuthorizedOrg(c);
      if (!org) {
        return c.json({ success: false, message: "Organization not found or access denied" }, 403);
      }

      const db = getUniversalDb(c.env?.DB);
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
          o.seat, 
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
        query += ` AND o.created_at >= ?`;
        params.push(startDate);
      }

      if (endDate) {
        query += ` AND o.created_at <= ?`;
        params.push(endDate);
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
            seat: r.seat,
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
      return c.json({ success: false, message: err.message }, 500);
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
        query += ` AND o.created_at >= ?`;
        params.push(startDate);
      }
      if (endDate) {
        query += ` AND o.created_at <= ?`;
        params.push(endDate);
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
  async getOrderById(c: Context<AppEnv>) {
    try {
      const id = c.req.param("id");
      const db = getUniversalDb(c.env?.DB);

      const row = (await db
        .prepare(
          `SELECT 
            id, display_id as displayId, organization_id as organizationId, short_code as shortCode,
            seat, location_id as locationId, location_name as locationName,
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
          seat: row.seat,
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

      // Generate readable display ID e.g. ORD-FTS-2026-000001
      const { displayId } = await getNextId(db, "ORD", org.shortCode);
      const orderId = body.id || displayId;

      let employeeId: string | null = null;
      let employeeName = body.employeeName || "Guest";
      let validatedSeatNumber = body.seat ? String(body.seat).padStart(2, "0") : "";
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

      const seat = validatedSeatNumber;
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
            id, display_id, organization_id, short_code, seat, location_id, location_name,
            employee_name, employee_id, qr_token, subtotal, adjustment_amount, discount, total, time, status, notes, items_json,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
        const oiId = `oi_${orderId}_${i + 1}`;
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
