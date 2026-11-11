import { Context } from "hono";
import { getUniversalDb } from "../db";
import { AppEnv } from "../types";
import { resolveAuthorizedOrg } from "../middleware/auth.middleware";
import { generateSeatQrToken } from "../utils/id-generator";

export interface TableModel {
  id: number;
  locationId: number;
  name: string;
  seatLimit: number;
  isActive: number;
  occupiedSeats?: number;
  availableSeats?: number;
  createdAt: string;
  updatedAt: string;
}

export const tableController = {
  // GET /api/locations/:locationId/tables
  async getTablesByLocation(c: Context<AppEnv>) {
    try {
      const org = await resolveAuthorizedOrg(c, { allowPublic: true });
      if (!org) {
        return c.json({ success: false, message: "Unauthorized or invalid organization context" }, 403);
      }

      const locationId = c.req.param("locationId");
      const db = getUniversalDb(c.env?.DB);

      // Verify location belongs to organization (safe column check)
      let loc: any = null;
      try {
        loc = await db
          .prepare(`SELECT id, name, organization_id, table_limit FROM locations WHERE (id = ? OR display_id = ?) AND organization_id = ?`)
          .bind(locationId, locationId, org.organizationId)
          .get();
      } catch {
        loc = await db
          .prepare(`SELECT id, name, organization_id FROM locations WHERE (id = ? OR display_id = ?) AND organization_id = ?`)
          .bind(locationId, locationId, org.organizationId)
          .get();
      }

      if (!loc) {
        return c.json({ success: false, message: "Location not found in this organization" }, 404);
      }

      const effectiveLocId = loc.id;

      // Query tables along with dynamic occupied / available count from seats / location_table_seats
      let rows: any[] = [];
      try {
        rows = (await db
          .prepare(
            `SELECT 
               t.id,
               t.location_id as locationId,
               t.table_name as name,
               t.table_limit as seatLimit,
               CASE WHEN t.status = 'active' THEN 1 ELSE 0 END as isActive,
               t.created_at as createdAt,
               t.updated_at as updatedAt,
               COUNT(s.id) as totalSeats,
               COUNT(CASE WHEN s.status = 'occupied' OR (s.employee_id IS NOT NULL AND s.employee_id != '') OR (s.employee_email IS NOT NULL AND s.employee_email != '') THEN 1 END) as occupiedSeats,
               COUNT(CASE WHEN (s.status = 'available' OR s.status IS NULL) AND (s.employee_id IS NULL OR s.employee_id = '') AND (s.employee_email IS NULL OR s.employee_email = '') THEN 1 END) as availableSeats
             FROM location_tables t
             LEFT JOIN location_table_seats s ON t.id = s.table_id
             WHERE t.location_id = ?
             GROUP BY t.id
             ORDER BY t.id ASC`
          )
          .bind(effectiveLocId)
          .all()) as any[];
      } catch {
        // Fallback to tables
        rows = (await db
          .prepare(
            `SELECT 
               t.id,
               t.location_id as locationId,
               t.name,
               t.seat_limit as seatLimit,
               t.is_active as isActive,
               t.created_at as createdAt,
               t.updated_at as updatedAt,
               COUNT(s.id) as totalSeats,
               COUNT(CASE WHEN s.status = 'occupied' OR (s.employee_id IS NOT NULL AND s.employee_id != '') OR (s.employee_email IS NOT NULL AND s.employee_email != '') OR (s.employee IS NOT NULL AND s.employee != '') THEN 1 END) as occupiedSeats,
               COUNT(CASE WHEN (s.status = 'available' OR s.status IS NULL) AND (s.employee_id IS NULL OR s.employee_id = '') AND (s.employee_email IS NULL OR s.employee_email = '') AND (s.employee IS NULL OR s.employee = '') THEN 1 END) as availableSeats
             FROM tables t
             LEFT JOIN seats s ON t.id = s.table_id
             WHERE t.location_id = ?
             GROUP BY t.id
             ORDER BY t.id ASC`
          )
          .bind(effectiveLocId)
          .all()) as any[];
      }

      const tables = (rows || []).map((r) => ({
        id: Number(r.id),
        locationId: Number(r.locationId),
        name: r.name,
        seatLimit: Number(r.seatLimit),
        isActive: Number(r.isActive) === 1 ? 1 : 0,
        occupiedSeats: Number(r.occupiedSeats) || 0,
        availableSeats: Math.max(0, (Number(r.seatLimit) || 0) - (Number(r.occupiedSeats) || 0)),
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }));

      return c.json({
        success: true,
        tables,
        tableLimit: Number(loc?.table_limit) || 5,
      });
    } catch (err: any) {
      console.error("getTablesByLocation error:", err);
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // POST /api/locations/:locationId/tables
  async createTable(c: Context<AppEnv>) {
    try {
      const org = await resolveAuthorizedOrg(c);
      if (!org) {
        return c.json({ success: false, message: "Unauthorized or invalid organization context" }, 403);
      }

      const locationId = c.req.param("locationId");
      const body = await c.req.json();
      const db = getUniversalDb(c.env?.DB);

      let loc: any = null;
      try {
        loc = await db
          .prepare(`SELECT id, name, organization_id, short_code, table_limit FROM locations WHERE (id = ? OR display_id = ?) AND organization_id = ?`)
          .bind(locationId, locationId, org.organizationId)
          .get();
      } catch {
        loc = await db
          .prepare(`SELECT id, name, organization_id, short_code FROM locations WHERE (id = ? OR display_id = ?) AND organization_id = ?`)
          .bind(locationId, locationId, org.organizationId)
          .get();
      }

      if (!loc) {
        return c.json({ success: false, message: "Location not found in this organization" }, 404);
      }

      const effectiveLocId = loc.id;
      const tableLimit = Number(loc?.table_limit) || 5;

      // Check current table count against location table_limit
      let currentTableCount = 0;
      try {
        const countRow = (await db
          .prepare(`SELECT COUNT(*) as cnt FROM location_tables WHERE location_id = ?`)
          .bind(effectiveLocId)
          .get()) as any;
        currentTableCount = Number(countRow?.cnt) || 0;
      } catch {
        const countRow = (await db
          .prepare(`SELECT COUNT(*) as cnt FROM tables WHERE location_id = ?`)
          .bind(effectiveLocId)
          .get()) as any;
        currentTableCount = Number(countRow?.cnt) || 0;
      }

      if (currentTableCount >= tableLimit) {
        return c.json({
          success: false,
          message: `Location reached maximum table limit of ${tableLimit}. You cannot add more tables.`,
        }, 400);
      }

      const tableName = (body.name || "").trim();
      if (!tableName) {
        return c.json({ success: false, message: "Table name is required." }, 400);
      }

      const seatLimit = Number(body.seatLimit);
      if (!seatLimit || seatLimit < 1) {
        return c.json({ success: false, message: "Seat limit must be greater than zero." }, 400);
      }

      const isActive = body.isActive !== undefined ? (body.isActive ? 1 : 0) : 1;

      // Prevent duplicate table name within this location (case-insensitive)
      let existingName: any = null;
      try {
        existingName = await db
          .prepare(`SELECT id FROM location_tables WHERE location_id = ? AND LOWER(TRIM(table_name)) = LOWER(TRIM(?))`)
          .bind(effectiveLocId, tableName)
          .get();
      } catch {}

      if (!existingName) {
        try {
          existingName = await db
            .prepare(`SELECT id FROM tables WHERE location_id = ? AND LOWER(TRIM(name)) = LOWER(TRIM(?))`)
            .bind(effectiveLocId, tableName)
            .get();
        } catch {}
      }

      if (existingName) {
        return c.json({
          success: false,
          message: `A table named '${tableName}' already exists in this location.`,
        }, 409);
      }

      const now = new Date().toISOString();

      // Insert Table
      const insertResult = (await db
        .prepare(
          `INSERT INTO tables (location_id, name, seat_limit, is_active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?) RETURNING id`
        )
        .bind(effectiveLocId, tableName, seatLimit, isActive, now, now)
        .get()) as any;

      let newTableId = insertResult?.id;
      if (!newTableId) {
        const fallback = (await db.prepare(`SELECT MAX(id) as maxId FROM tables WHERE location_id = ?`).bind(effectiveLocId).get()) as any;
        newTableId = fallback?.maxId;
      }

      // Also mirror insert into location_tables to ensure complete compatibility
      try {
        await db
          .prepare(
            `INSERT OR IGNORE INTO location_tables (id, organization_id, location_id, table_name, table_limit, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            newTableId,
            org.organizationId,
            effectiveLocId,
            tableName,
            seatLimit,
            isActive === 1 ? 'active' : 'inactive',
            now,
            now
          )
          .run();
      } catch (errSync) {
        // Safe fallback if location_tables not present yet
      }

      // Automatically generate seats 1..seatLimit with independent numbering starting at 1
      const shortCode = loc.short_code || org.shortCode || "FTS";
      for (let sNum = 1; sNum <= seatLimit; sNum++) {
        const qrToken = generateSeatQrToken();
        const orderUrl = `/${shortCode}/order/${qrToken}`;
        const seatUniqueId = `LOC-${effectiveLocId}-TBL-${newTableId}-SEAT-${sNum}`;

        await db
          .prepare(
            `INSERT INTO seats (
              id, table_id, location_id, organization_id, number, status, qr_token, order_url, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, 'available', ?, ?, ?, ?)`
          )
          .bind(
            seatUniqueId,
            newTableId,
            effectiveLocId,
            org.organizationId,
            sNum,
            qrToken,
            orderUrl,
            now,
            now
          )
          .run();

        // Also mirror into location_table_seats
        try {
          await db
            .prepare(
              `INSERT OR IGNORE INTO location_table_seats (
                id, organization_id, location_id, table_id, seat_number, seat_identifier, status, qr_token, order_url, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, 'available', ?, ?, ?, ?)`
            )
            .bind(
              seatUniqueId,
              org.organizationId,
              effectiveLocId,
              newTableId,
              sNum,
              `SEAT-${sNum}`,
              qrToken,
              orderUrl,
              now,
              now
            )
            .run();
        } catch (errSync) {
          // Safe fallback
        }
      }

      return c.json({
        success: true,
        message: "Table created successfully.",
        table: {
          id: newTableId,
          locationId: effectiveLocId,
          name: tableName,
          seatLimit,
          isActive,
          occupiedSeats: 0,
          availableSeats: seatLimit,
          createdAt: now,
          updatedAt: now,
        },
      }, 201);
    } catch (err: any) {
      console.error("createTable error:", err);
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // GET /api/tables/:tableId
  async getTableById(c: Context<AppEnv>) {
    try {
      const org = await resolveAuthorizedOrg(c, { allowPublic: true });
      if (!org) {
        return c.json({ success: false, message: "Unauthorized or invalid organization context" }, 403);
      }

      const tableId = c.req.param("tableId");
      const db = getUniversalDb(c.env?.DB);

      const table = (await db
        .prepare(
          `SELECT 
             t.id, t.location_id as locationId, t.name, t.seat_limit as seatLimit, t.is_active as isActive,
             t.created_at as createdAt, t.updated_at as updatedAt,
             l.name as locationName, l.organization_id as organizationId, l.status as locationStatus
           FROM tables t
           JOIN locations l ON t.location_id = l.id
           WHERE t.id = ? AND (l.organization_id = ? OR ? IS NULL)`
        )
        .bind(tableId, org.organizationId, org.organizationId)
        .get()) as any;

      let resolvedTable = table;
      if (!resolvedTable) {
        // Fallback check in location_tables
        try {
          const locTable = (await db
            .prepare(
              `SELECT 
                 t.id, t.location_id as locationId, t.table_name as name, t.table_limit as seatLimit,
                 CASE WHEN t.status = 'active' THEN 1 ELSE 0 END as isActive,
                 t.created_at as createdAt, t.updated_at as updatedAt,
                 l.name as locationName, l.organization_id as organizationId, l.status as locationStatus
               FROM location_tables t
               JOIN locations l ON t.location_id = l.id
               WHERE t.id = ? AND (l.organization_id = ? OR ? IS NULL)`
            )
            .bind(tableId, org.organizationId, org.organizationId)
            .get()) as any;
          if (locTable) {
            resolvedTable = locTable;
          }
        } catch {}
      }

      if (!resolvedTable) {
        // Safe fallback by checking without strict org filter if single org/public admin session
        const anyTable = (await db
          .prepare(
            `SELECT 
               t.id, t.location_id as locationId, t.name, t.seat_limit as seatLimit, t.is_active as isActive,
               t.created_at as createdAt, t.updated_at as updatedAt,
               l.name as locationName, l.organization_id as organizationId, l.status as locationStatus
             FROM tables t
             JOIN locations l ON t.location_id = l.id
             WHERE t.id = ?`
          )
          .bind(tableId)
          .get()) as any;
        if (anyTable) {
          resolvedTable = anyTable;
        }
      }

      if (!resolvedTable) {
        return c.json({ success: false, message: "Table not found" }, 404);
      }

      // Fetch seats for this table
      let seats: any[] = [];
      try {
        seats = (await db
          .prepare(
            `SELECT 
               s.id, s.table_id as tableId, s.location_id as locationId, s.organization_id as organizationId,
               s.number, s.status, s.employee_id as employeeId, s.employee, s.employee_name as employeeName,
               s.employee_email as employeeEmail, s.qr_token as qrToken, s.order_url as orderUrl,
               s.created_at as createdAt, s.updated_at as updatedAt,
               u.user_name as employeeUserName, u.user_type as employeeRole
             FROM seats s
             LEFT JOIN users u ON s.employee_id = u.id
             WHERE s.table_id = ? OR (s.location_id = ? AND (s.table_id IS NULL OR s.table_id = 0))
             ORDER BY CAST(s.number AS INTEGER) ASC`
          )
          .bind(tableId, resolvedTable.locationId)
          .all()) as any[];
      } catch (errSeats) {
        // Fallback to location_table_seats
        try {
          seats = (await db
            .prepare(
              `SELECT 
                 s.id, s.table_id as tableId, s.location_id as locationId, s.organization_id as organizationId,
                 s.seat_number as number, s.status, s.employee_id as employeeId,
                 s.employee_name as employeeName, s.employee_email as employeeEmail,
                 s.qr_token as qrToken, s.order_url as orderUrl,
                 s.created_at as createdAt, s.updated_at as updatedAt,
                 u.user_name as employeeUserName, u.user_type as employeeRole
               FROM location_table_seats s
               LEFT JOIN users u ON s.employee_id = u.id
               WHERE s.table_id = ? OR (s.location_id = ? AND (s.table_id IS NULL OR s.table_id = 0))
               ORDER BY CAST(s.seat_number AS INTEGER) ASC`
            )
            .bind(tableId, resolvedTable.locationId)
            .all()) as any[];
        } catch {}
      }

      const occupiedCount = seats.filter(
        (s) => s.status === "occupied" || (s.employeeEmail && s.employeeEmail.trim().length > 0) || (s.employeeName && s.employeeName.trim().length > 0)
      ).length;

      const effectiveSeatLimit = Number(resolvedTable.seatLimit) || seats.length || 0;
      const effectiveOccupied = occupiedCount;
      const effectiveAvailable = Math.max(0, effectiveSeatLimit - effectiveOccupied);
      const effectivePercentage = effectiveSeatLimit > 0 ? Math.round((effectiveOccupied / effectiveSeatLimit) * 100) : 0;

      return c.json({
        success: true,
        table: {
          id: Number(resolvedTable.id),
          locationId: Number(resolvedTable.locationId),
          locationName: resolvedTable.locationName,
          name: resolvedTable.name,
          seatLimit: effectiveSeatLimit,
          isActive: Number(resolvedTable.isActive) === 1 ? 1 : 0,
          occupiedSeats: effectiveOccupied,
          availableSeats: effectiveAvailable,
          occupancyPercentage: effectivePercentage,
          createdAt: resolvedTable.createdAt,
          updatedAt: resolvedTable.updatedAt,
          seats: (seats || []).map((s) => ({
            id: s.id,
            tableId: Number(s.tableId || resolvedTable.id),
            locationId: Number(s.locationId || resolvedTable.locationId),
            number: Number(s.number),
            status: s.status || "available",
            employeeId: s.employeeId || null,
            employeeName: s.employeeName || null,
            employeeEmail: s.employeeEmail || null,
            employeeUserName: s.employeeUserName || null,
            employeeStatus: s.employeeRole || "Active",
            qrToken: s.qrToken || null,
            orderUrl: s.orderUrl || null,
          })),
        },
      });
    } catch (err: any) {
      console.error("getTableById error:", err);
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // PUT /api/tables/:tableId
  async updateTable(c: Context<AppEnv>) {
    try {
      const org = await resolveAuthorizedOrg(c);
      if (!org) {
        return c.json({ success: false, message: "Unauthorized or invalid organization context" }, 403);
      }

      const tableId = c.req.param("tableId");
      const body = await c.req.json();
      const db = getUniversalDb(c.env?.DB);

      // Verify table ownership
      let table = (await db
        .prepare(`SELECT t.id, t.location_id, t.name, t.seat_limit, t.is_active FROM tables t JOIN locations l ON t.location_id = l.id WHERE t.id = ? AND (l.organization_id = ? OR ? IS NULL)`)
        .bind(tableId, org.organizationId, org.organizationId)
        .get()) as any;

      if (!table) {
        // Fallback check
        table = (await db
          .prepare(`SELECT t.id, t.location_id, t.name, t.seat_limit, t.is_active FROM tables t WHERE t.id = ?`)
          .bind(tableId)
          .get()) as any;
      }

      if (!table) {
        return c.json({ success: false, message: "Table not found" }, 404);
      }

      const newName = body.name !== undefined ? String(body.name).trim() : null;
      if (newName !== null) {
        if (!newName) {
          return c.json({ success: false, message: "Table name cannot be empty." }, 400);
        }
        // Unique check within same location
        const dup = (await db
          .prepare(`SELECT id FROM tables WHERE location_id = ? AND LOWER(TRIM(name)) = LOWER(TRIM(?)) AND id != ?`)
          .bind(table.location_id, newName, tableId)
          .get()) as any;

        if (dup) {
          return c.json({ success: false, message: `A table named '${newName}' already exists in this location.` }, 409);
        }
      }

      const now = new Date().toISOString();
      const isActive = body.isActive !== undefined ? (body.isActive ? 1 : 0) : table.is_active;

      // Handle seatLimit update if provided in Edit Table
      let targetSeatLimit = Number(table.seat_limit) || 0;
      if (body.seatLimit !== undefined && body.seatLimit !== null) {
        const parsedLimit = Number(body.seatLimit);
        if (!parsedLimit || parsedLimit < 1) {
          return c.json({ success: false, message: "Seat limit must be a positive integer." }, 400);
        }

        // Count occupied seats
        const occRow = (await db
          .prepare(
            `SELECT COUNT(*) as occCount FROM seats 
             WHERE table_id = ? AND (
               status = 'occupied' OR 
               (employee_id IS NOT NULL AND employee_id != '') OR 
               (employee_name IS NOT NULL AND employee_name != '') OR 
               (employee_email IS NOT NULL AND employee_email != '')
             )`
          )
          .bind(tableId)
          .get()) as any;

        const occupiedCount = Number(occRow?.occCount) || 0;
        if (parsedLimit < occupiedCount) {
          return c.json({
            success: false,
            message: `Seat limit cannot be less than currently occupied seats (${occupiedCount}).`,
          }, 400);
        }

        // If expanding seat limit, generate new seats
        if (parsedLimit > targetSeatLimit) {
          const maxNumRow = (await db
            .prepare(`SELECT MAX(number) as maxNum FROM seats WHERE table_id = ?`)
            .bind(tableId)
            .get()) as any;
          const startNum = (Number(maxNumRow?.maxNum) || targetSeatLimit) + 1;
          const shortCode = org.shortCode || "FTS";

          for (let sNum = startNum; sNum <= parsedLimit; sNum++) {
            const qrToken = generateSeatQrToken();
            const orderUrl = `/${shortCode}/order/${qrToken}`;
            const seatUniqueId = `LOC-${table.location_id}-TBL-${tableId}-SEAT-${sNum}`;

            await db
              .prepare(
                `INSERT INTO seats (
                  id, table_id, location_id, organization_id, number, status, qr_token, order_url, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, 'available', ?, ?, ?, ?)`
              )
              .bind(seatUniqueId, tableId, table.location_id, org.organizationId, sNum, qrToken, orderUrl, now, now)
              .run();

            try {
              await db
                .prepare(
                  `INSERT OR IGNORE INTO location_table_seats (
                    id, organization_id, location_id, table_id, seat_number, seat_identifier, status, qr_token, order_url, created_at, updated_at
                  ) VALUES (?, ?, ?, ?, ?, ?, 'available', ?, ?, ?, ?)`
                )
                .bind(seatUniqueId, org.organizationId, table.location_id, tableId, sNum, `SEAT-${sNum}`, qrToken, orderUrl, now, now)
                .run();
            } catch {}
          }
        } else if (parsedLimit < targetSeatLimit) {
          // If reducing limit safely, remove unassigned/available seats above parsedLimit
          await db
            .prepare(
              `DELETE FROM seats 
               WHERE table_id = ? AND number > ? 
                 AND status != 'occupied' 
                 AND (employee_id IS NULL OR employee_id = '')
                 AND (employee_email IS NULL OR employee_email = '')`
            )
            .bind(tableId, parsedLimit)
            .run();

          try {
            await db
              .prepare(
                `DELETE FROM location_table_seats 
                 WHERE table_id = ? AND seat_number > ? 
                   AND status != 'occupied' 
                   AND (employee_id IS NULL OR employee_id = '')`
              )
              .bind(tableId, parsedLimit)
              .run();
          } catch {}
        }

        targetSeatLimit = parsedLimit;
      }

      await db
        .prepare(
          `UPDATE tables SET name = COALESCE(?, name), seat_limit = ?, is_active = ?, updated_at = ? WHERE id = ?`
        )
        .bind(newName, targetSeatLimit, isActive, now, tableId)
        .run();

      try {
        await db
          .prepare(`UPDATE location_tables SET table_name = COALESCE(?, table_name), table_limit = ?, status = ?, updated_at = ? WHERE id = ?`)
          .bind(newName, targetSeatLimit, isActive === 1 ? 'active' : 'inactive', now, tableId)
          .run();
      } catch (errSync) {}

      return c.json({
        success: true,
        message: "Table updated successfully.",
        table: {
          id: Number(tableId),
          name: newName || table.name,
          seatLimit: targetSeatLimit,
          isActive,
        },
      });
    } catch (err: any) {
      console.error("updateTable error:", err);
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // PATCH /api/tables/:tableId/status
  async toggleTableStatus(c: Context<AppEnv>) {
    try {
      const org = await resolveAuthorizedOrg(c);
      if (!org) {
        return c.json({ success: false, message: "Unauthorized or invalid organization context" }, 403);
      }

      const tableId = c.req.param("tableId");
      const db = getUniversalDb(c.env?.DB);

      const table = (await db
        .prepare(`SELECT t.id, t.is_active FROM tables t JOIN locations l ON t.location_id = l.id WHERE t.id = ? AND l.organization_id = ?`)
        .bind(tableId, org.organizationId)
        .get()) as any;

      if (!table) {
        return c.json({ success: false, message: "Table not found" }, 404);
      }

      const nextStatus = Number(table.is_active) === 1 ? 0 : 1;
      const now = new Date().toISOString();

      await db.prepare(`UPDATE tables SET is_active = ?, updated_at = ? WHERE id = ?`).bind(nextStatus, now, tableId).run();

      return c.json({ success: true, isActive: nextStatus });
    } catch (err: any) {
      console.error("toggleTableStatus error:", err);
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // DELETE /api/tables/:tableId
  async deleteTable(c: Context<AppEnv>) {
    try {
      const org = await resolveAuthorizedOrg(c);
      if (!org) {
        return c.json({ success: false, message: "Unauthorized or invalid organization context" }, 403);
      }

      const tableId = c.req.param("tableId");
      const db = getUniversalDb(c.env?.DB);

      const table = (await db
        .prepare(`SELECT t.id, t.location_id FROM tables t JOIN locations l ON t.location_id = l.id WHERE t.id = ? AND l.organization_id = ?`)
        .bind(tableId, org.organizationId)
        .get()) as any;

      if (!table) {
        return c.json({ success: false, message: "Table not found" }, 404);
      }

      // Check if table has active assigned employees
      const assignedCountRow = (await db
        .prepare(
          `SELECT COUNT(*) as cnt FROM seats 
           WHERE table_id = ? AND (
             status = 'occupied' OR 
             (employee_id IS NOT NULL AND employee_id != '') OR 
             (employee_email IS NOT NULL AND employee_email != '')
           )`
        )
        .bind(tableId)
        .get()) as any;

      const assignedCount = Number(assignedCountRow?.cnt) || 0;
      if (assignedCount > 0) {
        return c.json({
          success: false,
          message: `Cannot delete table because it has ${assignedCount} assigned employee(s). Please unassign them first.`,
        }, 400);
      }

      // Delete table's seats first safely
      await db.prepare(`DELETE FROM seats WHERE table_id = ?`).bind(tableId).run();
      await db.prepare(`DELETE FROM tables WHERE id = ?`).bind(tableId).run();

      try {
        await db.prepare(`DELETE FROM location_table_seats WHERE table_id = ?`).bind(tableId).run();
        await db.prepare(`DELETE FROM location_tables WHERE id = ?`).bind(tableId).run();
      } catch (errSync) {}

      return c.json({ success: true, message: "Table deleted successfully." });
    } catch (err: any) {
      console.error("deleteTable error:", err);
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // POST /api/tables/:tableId/seats (Add seats / expand seat limit)
  async addSeatsToTable(c: Context<AppEnv>) {
    try {
      const org = await resolveAuthorizedOrg(c);
      if (!org) {
        return c.json({ success: false, message: "Unauthorized or invalid organization context" }, 403);
      }

      const tableId = c.req.param("tableId");
      const body = await c.req.json();
      const db = getUniversalDb(c.env?.DB);

      let table = (await db
        .prepare(
          `SELECT t.id, t.location_id, t.seat_limit, l.short_code 
           FROM tables t 
           JOIN locations l ON t.location_id = l.id 
           WHERE t.id = ? AND (l.organization_id = ? OR ? IS NULL)`
        )
        .bind(tableId, org.organizationId, org.organizationId)
        .get()) as any;

      if (!table) {
        table = (await db
          .prepare(`SELECT t.id, t.location_id, t.seat_limit FROM tables t WHERE t.id = ?`)
          .bind(tableId)
          .get()) as any;
      }

      if (!table) {
        return c.json({ success: false, message: "Table not found" }, 404);
      }

      const currentLimit = Number(table.seat_limit) || 0;
      let newLimit = 0;

      if (body.seatLimit !== undefined) {
        newLimit = Number(body.seatLimit);
      } else if (body.additionalSeats !== undefined) {
        newLimit = currentLimit + Number(body.additionalSeats);
      }

      if (!newLimit || newLimit <= currentLimit) {
        return c.json({
          success: false,
          message: `New seat limit (${newLimit}) must be greater than current seat limit (${currentLimit}).`,
        }, 400);
      }

      // Find highest existing seat number for this table
      const maxNumRow = (await db
        .prepare(`SELECT MAX(number) as maxNum FROM seats WHERE table_id = ?`)
        .bind(tableId)
        .get()) as any;

      const startNum = Math.max(Number(maxNumRow?.maxNum) || 0, currentLimit) + 1;
      const now = new Date().toISOString();
      const shortCode = table.short_code || org.shortCode || "FTS";

      for (let sNum = startNum; sNum <= newLimit; sNum++) {
        const qrToken = generateSeatQrToken();
        const orderUrl = `/${shortCode}/order/${qrToken}`;
        const seatUniqueId = `LOC-${table.location_id}-TBL-${tableId}-SEAT-${sNum}`;

        await db
          .prepare(
            `INSERT INTO seats (
              id, table_id, location_id, organization_id, number, status, qr_token, order_url, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, 'available', ?, ?, ?, ?)`
          )
          .bind(
            seatUniqueId,
            tableId,
            table.location_id,
            org.organizationId,
            sNum,
            qrToken,
            orderUrl,
            now,
            now
          )
          .run();

        try {
          await db
            .prepare(
              `INSERT OR IGNORE INTO location_table_seats (
                id, organization_id, location_id, table_id, seat_number, seat_identifier, status, qr_token, order_url, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, 'available', ?, ?, ?, ?)`
            )
            .bind(seatUniqueId, org.organizationId, table.location_id, tableId, sNum, `SEAT-${sNum}`, qrToken, orderUrl, now, now)
            .run();
        } catch {}
      }

      // Update seat_limit on tables
      await db
        .prepare(`UPDATE tables SET seat_limit = ?, updated_at = ? WHERE id = ?`)
        .bind(newLimit, now, tableId)
        .run();

      try {
        await db
          .prepare(`UPDATE location_tables SET table_limit = ?, updated_at = ? WHERE id = ?`)
          .bind(newLimit, now, tableId)
          .run();
      } catch {}

      return c.json({
        success: true,
        message: `Successfully added ${newLimit - currentLimit} seats. New seat limit is ${newLimit}.`,
        seatLimit: newLimit,
      });
    } catch (err: any) {
      console.error("addSeatsToTable error:", err);
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // PATCH /api/seats/:seatId/assign
  async assignSeat(c: Context<AppEnv>) {
    try {
      const org = await resolveAuthorizedOrg(c);
      if (!org) {
        return c.json({ success: false, message: "Unauthorized or invalid organization context" }, 403);
      }

      const seatId = c.req.param("seatId");
      const body = await c.req.json();
      const db = getUniversalDb(c.env?.DB);

      const seat = (await db
        .prepare(
          `SELECT s.id, s.table_id, s.location_id, s.number, s.status, s.organization_id 
           FROM seats s 
           JOIN locations l ON s.location_id = l.id 
           WHERE s.id = ? AND s.organization_id = ?`
        )
        .bind(seatId, org.organizationId)
        .get()) as any;

      if (!seat) {
        return c.json({ success: false, message: "Seat not found in this organization" }, 404);
      }

      const employeeId = body.employeeId || null;
      const employeeEmail = (body.employeeEmail || "").trim().toLowerCase();
      const employeeName = (body.employeeName || "").trim();

      if (!employeeId && !employeeEmail && !employeeName) {
        return c.json({ success: false, message: "Employee details are required for assignment" }, 400);
      }

      const now = new Date().toISOString();

      // Check if employee is already assigned to another seat in this organization
      if (employeeId || employeeEmail) {
        const existingAssign = (await db
          .prepare(
            `SELECT id, table_id, number FROM seats 
             WHERE organization_id = ? 
               AND (employee_id = ? OR LOWER(employee_email) = ?) 
               AND id != ?`
          )
          .bind(org.organizationId, employeeId, employeeEmail, seatId)
          .get()) as any;

        if (existingAssign) {
          return c.json({
            success: false,
            message: `This employee is already assigned to Seat ${existingAssign.number}. Please unassign them first.`,
          }, 409);
        }
      }

      await db
        .prepare(
          `UPDATE seats 
           SET employee_id = ?, employee_name = ?, employee_email = ?, employee = ?, status = 'occupied', updated_at = ? 
           WHERE id = ?`
        )
        .bind(employeeId, employeeName, employeeEmail, employeeEmail || employeeName, now, seatId)
        .run();

      // Mirror update to location_table_seats and employee_seat_assignments
      try {
        await db
          .prepare(
            `UPDATE location_table_seats 
             SET employee_id = ?, employee_name = ?, employee_email = ?, status = 'occupied', updated_at = ? 
             WHERE id = ?`
          )
          .bind(employeeId, employeeName, employeeEmail, now, seatId)
          .run();
      } catch {}

      if (employeeId) {
        try {
          const esaId = `ESA-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          await db
            .prepare(
              `INSERT INTO employee_seat_assignments (id, organization_id, location_id, seat_id, employee_id, assigned_at, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(location_id, seat_id) DO UPDATE SET employee_id = excluded.employee_id, updated_at = excluded.updated_at`
            )
            .bind(esaId, org.organizationId, seat.location_id, seatId, employeeId, now, now, now)
            .run();
        } catch {}
      }

      return c.json({ success: true, message: "Seat assigned successfully." });
    } catch (err: any) {
      console.error("assignSeat error:", err);
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // POST /api/seats/:seatId/transfer
  async transferSeat(c: Context<AppEnv>) {
    try {
      const org = await resolveAuthorizedOrg(c);
      if (!org) {
        return c.json({ success: false, message: "Unauthorized or invalid organization context" }, 403);
      }

      const sourceSeatId = c.req.param("seatId");
      const body = await c.req.json();
      const targetSeatId = body.targetSeatId;

      if (!targetSeatId) {
        return c.json({ success: false, message: "Target seat ID is required" }, 400);
      }

      const db = getUniversalDb(c.env?.DB);

      // Verify source seat
      const sourceSeat = (await db
        .prepare(`SELECT * FROM seats WHERE id = ? AND organization_id = ?`)
        .bind(sourceSeatId, org.organizationId)
        .get()) as any;

      if (!sourceSeat) {
        return c.json({ success: false, message: "Source seat not found" }, 404);
      }

      if (!sourceSeat.employee_id && !sourceSeat.employee_name && !sourceSeat.employee_email) {
        return c.json({ success: false, message: "Source seat does not have an assigned employee to transfer" }, 400);
      }

      // Verify target seat
      const targetSeat = (await db
        .prepare(`SELECT * FROM seats WHERE id = ? AND organization_id = ?`)
        .bind(targetSeatId, org.organizationId)
        .get()) as any;

      if (!targetSeat) {
        return c.json({ success: false, message: "Target seat not found" }, 404);
      }

      if (targetSeat.status === "blocked") {
        return c.json({ success: false, message: "Target seat is blocked and cannot receive assignments" }, 400);
      }

      if (targetSeat.employee_id || targetSeat.employee_name || targetSeat.employee_email) {
        return c.json({ success: false, message: `Target Seat ${targetSeat.number} is already occupied by ${targetSeat.employee_name || targetSeat.employee_email}` }, 409);
      }

      const now = new Date().toISOString();

      // 1. Move employee info to target seat
      await db
        .prepare(
          `UPDATE seats 
           SET employee_id = ?, employee_name = ?, employee_email = ?, employee = ?, status = 'occupied', updated_at = ? 
           WHERE id = ?`
        )
        .bind(
          sourceSeat.employee_id,
          sourceSeat.employee_name,
          sourceSeat.employee_email,
          sourceSeat.employee,
          now,
          targetSeatId
        )
        .run();

      // 2. Clear source seat
      await db
        .prepare(
          `UPDATE seats 
           SET employee_id = NULL, employee_name = NULL, employee_email = NULL, employee = NULL, status = 'available', updated_at = ? 
           WHERE id = ?`
        )
        .bind(now, sourceSeatId)
        .run();

      // 3. Mirror to location_table_seats
      try {
        await db
          .prepare(`UPDATE location_table_seats SET employee_id = ?, employee_name = ?, employee_email = ?, status = 'occupied', updated_at = ? WHERE id = ?`)
          .bind(sourceSeat.employee_id, sourceSeat.employee_name, sourceSeat.employee_email, now, targetSeatId)
          .run();
        await db
          .prepare(`UPDATE location_table_seats SET employee_id = NULL, employee_name = NULL, employee_email = NULL, status = 'available', updated_at = ? WHERE id = ?`)
          .bind(now, sourceSeatId)
          .run();
      } catch {}

      // 4. Update employee_seat_assignments table
      try {
        await db
          .prepare(`DELETE FROM employee_seat_assignments WHERE seat_id = ?`)
          .bind(sourceSeatId)
          .run();
        if (sourceSeat.employee_id) {
          const esaId = `ESA-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          await db
            .prepare(
              `INSERT INTO employee_seat_assignments (id, organization_id, location_id, seat_id, employee_id, assigned_at, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(esaId, org.organizationId, targetSeat.location_id, targetSeatId, sourceSeat.employee_id, now, now, now)
            .run();
        }
      } catch {}

      return c.json({
        success: true,
        message: `Employee transferred from Seat ${sourceSeat.number} to Seat ${targetSeat.number} successfully.`,
      });
    } catch (err: any) {
      console.error("transferSeat error:", err);
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // GET /api/locations/:locationId/occupied-employees
  async getLocationOccupiedEmployees(c: Context<AppEnv>) {
    try {
      const org = await resolveAuthorizedOrg(c, { allowPublic: true });
      if (!org) {
        return c.json({ success: false, message: "Unauthorized or invalid organization context" }, 403);
      }

      const locationId = c.req.param("locationId");
      const search = (c.req.query("search") || "").trim().toLowerCase();
      const tableIdFilter = c.req.query("tableId") || "";
      const seatNumberFilter = c.req.query("seatNumber") || "";
      const page = Math.max(1, parseInt(c.req.query("page") || "1", 10));
      const limit = Math.max(1, Math.min(100, parseInt(c.req.query("limit") || "50", 10)));

      const db = getUniversalDb(c.env?.DB);

      // Verify location belongs to organization
      let loc: any = null;
      try {
        loc = await db
          .prepare(`SELECT id, name, organization_id FROM locations WHERE (id = ? OR display_id = ?) AND (organization_id = ? OR ? IS NULL)`)
          .bind(locationId, locationId, org.organizationId, org.organizationId)
          .get();
      } catch {
        loc = await db
          .prepare(`SELECT id, name FROM locations WHERE id = ? OR display_id = ?`)
          .bind(locationId, locationId)
          .get();
      }

      if (!loc) {
        return c.json({ success: false, message: "Location not found" }, 404);
      }

      const effectiveLocId = loc.id;

      // Query occupied seats with table details across the entire location
      let rows: any[] = [];
      try {
        rows = (await db
          .prepare(
            `SELECT 
               s.id as seatId,
               s.number as seatNumber,
               s.status as seatStatus,
               s.employee_id as employeeId,
               s.employee_name as employeeName,
               s.employee_email as employeeEmail,
               s.qr_token as qrToken,
               s.order_url as orderUrl,
               s.created_at as seatCreatedAt,
               s.updated_at as seatUpdatedAt,
               COALESCE(esa.assigned_at, s.updated_at, s.created_at) as assignmentDate,
               t.id as tableId,
               t.name as tableName,
               u.user_name as employeeUserName,
               u.user_type as employeeRole
             FROM seats s
             JOIN tables t ON s.table_id = t.id
             LEFT JOIN employee_seat_assignments esa ON s.id = esa.seat_id
             LEFT JOIN users u ON s.employee_id = u.id
             WHERE s.location_id = ?
               AND (
                 s.status = 'occupied' 
                 OR (s.employee_name IS NOT NULL AND TRIM(s.employee_name) != '')
                 OR (s.employee_email IS NOT NULL AND TRIM(s.employee_email) != '')
               )
             ORDER BY t.id ASC, CAST(s.number AS INTEGER) ASC`
          )
          .bind(effectiveLocId)
          .all()) as any[];
      } catch {
        // Fallback to location_tables and location_table_seats
        try {
          rows = (await db
            .prepare(
              `SELECT 
                 s.id as seatId,
                 s.seat_number as seatNumber,
                 s.seat_identifier as seatIdentifier,
                 s.status as seatStatus,
                 s.employee_id as employeeId,
                 s.employee_name as employeeName,
                 s.employee_email as employeeEmail,
                 s.qr_token as qrToken,
                 s.order_url as orderUrl,
                 s.created_at as seatCreatedAt,
                 s.updated_at as seatUpdatedAt,
                 COALESCE(s.updated_at, s.created_at) as assignmentDate,
                 t.id as tableId,
                 t.table_name as tableName,
                 u.user_name as employeeUserName,
                 u.user_type as employeeRole
               FROM location_table_seats s
               JOIN location_tables t ON s.table_id = t.id
               LEFT JOIN users u ON s.employee_id = u.id
               WHERE s.location_id = ?
                 AND (
                   s.status = 'occupied' 
                   OR (s.employee_name IS NOT NULL AND TRIM(s.employee_name) != '')
                   OR (s.employee_email IS NOT NULL AND TRIM(s.employee_email) != '')
                 )
               ORDER BY t.id ASC, CAST(s.seat_number AS INTEGER) ASC`
            )
            .bind(effectiveLocId)
            .all()) as any[];
        } catch {}
      }

      let allEmployees = rows.map((r) => ({
        seatId: r.seatId,
        seatNumber: Number(r.seatNumber),
        seatIdentifier: r.seatIdentifier || `SEAT-${r.seatNumber}`,
        seatStatus: r.seatStatus || "occupied",
        employeeId: r.employeeId || `EMP-${r.seatNumber}`,
        employeeName: r.employeeName || "Assigned Employee",
        employeeEmail: r.employeeEmail || "",
        employeeUserName: r.employeeUserName || null,
        employeeRole: r.employeeRole || "Employee",
        tableId: Number(r.tableId),
        tableName: r.tableName || `Table ${r.tableId}`,
        assignmentDate: r.assignmentDate || r.seatUpdatedAt || new Date().toISOString(),
        qrToken: r.qrToken || null,
        orderUrl: r.orderUrl || null,
      }));

      // Apply Search Filter
      if (search) {
        allEmployees = allEmployees.filter((emp) => {
          return (
            (emp.employeeName && emp.employeeName.toLowerCase().includes(search)) ||
            (emp.employeeId && emp.employeeId.toLowerCase().includes(search)) ||
            (emp.employeeEmail && emp.employeeEmail.toLowerCase().includes(search)) ||
            (emp.tableName && emp.tableName.toLowerCase().includes(search)) ||
            String(emp.seatNumber).includes(search)
          );
        });
      }

      // Apply Table Filter
      if (tableIdFilter && tableIdFilter !== "all") {
        const tid = Number(tableIdFilter);
        allEmployees = allEmployees.filter((emp) => emp.tableId === tid);
      }

      // Apply Seat Number Filter
      if (seatNumberFilter && seatNumberFilter !== "all") {
        const snum = Number(seatNumberFilter);
        allEmployees = allEmployees.filter((emp) => emp.seatNumber === snum);
      }

      const totalCount = allEmployees.length;
      const tablesRepresented = new Set(allEmployees.map((e) => e.tableId)).size;

      // Pagination
      const startIndex = (page - 1) * limit;
      const paginatedEmployees = allEmployees.slice(startIndex, startIndex + limit);

      return c.json({
        success: true,
        locationId: effectiveLocId,
        locationName: loc.name,
        totalOccupiedEmployees: totalCount,
        totalTablesRepresented: tablesRepresented,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit) || 1,
        employees: paginatedEmployees,
      });
    } catch (err: any) {
      console.error("getLocationOccupiedEmployees error:", err);
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // GET /api/tables/:tableId/seats
  async getTableSeats(c: Context<AppEnv>) {
    try {
      const org = await resolveAuthorizedOrg(c, { allowPublic: true });
      if (!org) {
        return c.json({ success: false, message: "Unauthorized" }, 403);
      }
      const tableId = c.req.param("tableId");
      const db = getUniversalDb(c.env?.DB);

      const seats = (await db
        .prepare(
          `SELECT s.id, s.table_id as tableId, s.location_id as locationId, s.organization_id as organizationId,
                  s.number, s.status, s.employee_id as employeeId, s.employee_name as employeeName,
                  s.employee_email as employeeEmail, s.qr_token as qrToken, s.order_url as orderUrl
           FROM seats s
           JOIN tables t ON s.table_id = t.id
           JOIN locations l ON t.location_id = l.id
           WHERE s.table_id = ? AND l.organization_id = ?
           ORDER BY s.number ASC`
        )
        .bind(tableId, org.organizationId)
        .all()) as any[];

      return c.json({ success: true, seats });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // GET /api/tables/:tableId/employees
  async getTableEmployees(c: Context<AppEnv>) {
    try {
      const org = await resolveAuthorizedOrg(c);
      if (!org) {
        return c.json({ success: false, message: "Unauthorized" }, 403);
      }
      const tableId = c.req.param("tableId");
      const db = getUniversalDb(c.env?.DB);

      const employees = (await db
        .prepare(
          `SELECT s.id as seatId, s.number as seatNumber, s.employee_id as employeeId,
                  s.employee_name as employeeName, s.employee_email as employeeEmail,
                  s.updated_at as assignedAt, u.user_name as userName, u.user_type as userStatus
           FROM seats s
           JOIN tables t ON s.table_id = t.id
           JOIN locations l ON t.location_id = l.id
           LEFT JOIN users u ON s.employee_id = u.id
           WHERE s.table_id = ? AND (l.organization_id = ? OR ? IS NULL)
             AND (s.status = 'occupied' OR (s.employee_name IS NOT NULL AND s.employee_name != ''))
           ORDER BY s.number ASC`
        )
        .bind(tableId, org.organizationId, org.organizationId)
        .all()) as any[];

      return c.json({ success: true, employees });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // GET /api/tables/:tableId/orders
  async getTableOrders(c: Context<AppEnv>) {
    try {
      const org = await resolveAuthorizedOrg(c);
      if (!org) {
        return c.json({ success: false, message: "Unauthorized" }, 403);
      }
      const tableId = c.req.param("tableId");
      const range = c.req.query("range") || "all";
      const db = getUniversalDb(c.env?.DB);

      // Get seats for this table
      const seats = (await db
        .prepare(`SELECT id, number, employee_id, employee_email, employee_name FROM seats WHERE table_id = ?`)
        .bind(tableId)
        .all()) as any[];

      if (!seats || seats.length === 0) {
        return c.json({ success: true, orders: [] });
      }

      const seatIds = seats.map((s) => s.id);
      const empIds = seats.map((s) => s.employee_id).filter(Boolean);
      const empEmails = seats.map((s) => s.employee_email).filter(Boolean);

      // Build date condition
      let dateCondition = "";
      if (range === "today") {
        dateCondition = " AND date(o.created_at) = date('now')";
      } else if (range === "week") {
        dateCondition = " AND date(o.created_at) >= date('now', '-7 days')";
      } else if (range === "month") {
        dateCondition = " AND date(o.created_at) >= date('now', '-30 days')";
      }

      let whereClauses: string[] = [];
      let params: any[] = [org.organizationId];

      // Match orders by seat_id or employee
      const matchConditions: string[] = [];
      if (seatIds.length > 0) {
        matchConditions.push(`o.seat_id IN (${seatIds.map(() => "?").join(",")})`);
        params.push(...seatIds);
      }
      if (empIds.length > 0) {
        matchConditions.push(`o.employee_id IN (${empIds.map(() => "?").join(",")})`);
        params.push(...empIds);
      }
      if (empEmails.length > 0) {
        matchConditions.push(`LOWER(o.employee_name) IN (${empEmails.map(() => "?").join(",")})`);
        params.push(...empEmails.map((e: string) => e.toLowerCase()));
      }

      if (matchConditions.length === 0) {
        return c.json({ success: true, orders: [] });
      }

      const sql = `
        SELECT o.id, o.display_id as displayId, o.seat_id as seatId, o.seat,
               o.employee_name as employeeName, o.total, o.status, o.time,
               o.items_json as itemsJson, o.created_at as createdAt
        FROM orders o
        WHERE o.organization_id = ? AND (${matchConditions.join(" OR ")})
        ${dateCondition}
        ORDER BY o.created_at DESC
      `;

      const rows = (await db.prepare(sql).bind(...params).all()) as any[];

      const orders = rows.map((r) => {
        let items: any[] = [];
        try {
          items = JSON.parse(r.itemsJson || "[]");
        } catch {}
        return {
          id: r.id,
          displayId: r.displayId || r.id,
          seatId: r.seatId || r.seat,
          employeeName: r.employeeName,
          total: Number(r.total) || 0,
          status: r.status || "Pending",
          time: r.time,
          createdAt: r.createdAt,
          items,
        };
      });

      return c.json({ success: true, orders });
    } catch (err: any) {
      console.error("getTableOrders error:", err);
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // GET /api/tables/:tableId/statistics
  async getTableStatistics(c: Context<AppEnv>) {
    try {
      const org = await resolveAuthorizedOrg(c, { allowPublic: true });
      if (!org) {
        return c.json({ success: false, message: "Unauthorized" }, 403);
      }
      const tableId = c.req.param("tableId");
      const db = getUniversalDb(c.env?.DB);

      const table = (await db
        .prepare(`SELECT t.id, t.seat_limit, t.name FROM tables t JOIN locations l ON t.location_id = l.id WHERE t.id = ? AND l.organization_id = ?`)
        .bind(tableId, org.organizationId)
        .get()) as any;

      if (!table) {
        return c.json({ success: false, message: "Table not found" }, 404);
      }

      const seats = (await db
        .prepare(`SELECT id, status, employee_id, employee_name, employee_email FROM seats WHERE table_id = ?`)
        .bind(tableId)
        .all()) as any[];

      const seatLimit = Number(table.seat_limit) || 0;
      const occupiedSeats = seats.filter(
        (s) => s.status === "occupied" || (s.employeeName && s.employeeName.trim().length > 0) || (s.employeeEmail && s.employeeEmail.trim().length > 0)
      ).length;
      const availableSeats = Math.max(0, seatLimit - occupiedSeats);
      const occupancyPercentage = seatLimit > 0 ? Math.round((occupiedSeats / seatLimit) * 100) : 0;

      return c.json({
        success: true,
        statistics: {
          seatLimit,
          occupiedSeats,
          availableSeats,
          occupancyPercentage,
        },
      });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // GET /api/seats/:seatId/details (Detailed Employee & Seat Profile)
  async getSeatDetails(c: Context<AppEnv>) {
    try {
      const org = await resolveAuthorizedOrg(c, { allowPublic: true });
      if (!org) {
        return c.json({ success: false, message: "Unauthorized or invalid organization context" }, 403);
      }

      const seatId = c.req.param("seatId");
      const db = getUniversalDb(c.env?.DB);

      let seat = (await db
        .prepare(
          `SELECT 
             s.id as seatId, s.table_id as tableId, s.location_id as locationId, s.organization_id as organizationId,
             s.number as seatNumber, s.status as seatStatus, s.employee_id as employeeId, s.employee,
             s.employee_name as employeeName, s.employee_email as employeeEmail, s.qr_token as qrToken,
             s.order_url as orderUrl, s.created_at as seatCreatedAt, s.updated_at as seatUpdatedAt,
             COALESCE(esa.assigned_at, s.updated_at, s.created_at) as assignmentDate,
             t.name as tableName,
             l.name as locationName, l.short_code as locationShortCode,
             o.name as organizationName, o.short_code as orgShortCode,
             u.user_name as employeeUserName, u.user_type as employeeRole
           FROM seats s
           LEFT JOIN tables t ON s.table_id = t.id
           LEFT JOIN locations l ON s.location_id = l.id
           LEFT JOIN organizations o ON s.organization_id = o.id
           LEFT JOIN employee_seat_assignments esa ON s.id = esa.seat_id
           LEFT JOIN users u ON s.employee_id = u.id
           WHERE s.id = ?`
        )
        .bind(seatId)
        .get()) as any;

      if (!seat) {
        return c.json({ success: false, message: "Seat not found" }, 404);
      }

      const shortCode = seat.orgShortCode || seat.locationShortCode || org.shortCode || "FTS";
      
      // Ensure seat has a valid qrToken and orderUrl
      let qrToken = seat.qrToken;
      let orderUrl = seat.orderUrl;
      if (!qrToken) {
        qrToken = `SEAT_QR_${seat.locationId}_${seat.tableId}_${seat.seatNumber}`;
        orderUrl = `/${shortCode}/order/${qrToken}`;
        try {
          await db
            .prepare(`UPDATE seats SET qr_token = ?, order_url = ? WHERE id = ?`)
            .bind(qrToken, orderUrl, seatId)
            .run();
        } catch {}
      } else if (!orderUrl) {
        orderUrl = `/${shortCode}/order/${qrToken}`;
      }

      // Query employee's order metrics & recent orders
      let orders: any[] = [];
      const empLookupConditions: string[] = [`o.seat_id = ?`];
      const empLookupParams: any[] = [seatId];

      if (seat.employeeId) {
        empLookupConditions.push(`o.employee_id = ?`);
        empLookupParams.push(seat.employeeId);
      }
      if (seat.employeeEmail) {
        empLookupConditions.push(`LOWER(o.employee_name) = LOWER(?)`);
        empLookupParams.push(seat.employeeEmail);
      } else if (seat.employeeName) {
        empLookupConditions.push(`LOWER(o.employee_name) = LOWER(?)`);
        empLookupParams.push(seat.employeeName);
      }

      try {
        const orderRows = (await db
          .prepare(
            `SELECT 
               o.id, o.display_id as displayId, o.seat_id as seatId, o.seat,
               o.employee_name as employeeName, o.total, o.status, o.time,
               o.items_json as itemsJson, o.created_at as createdAt
             FROM orders o
             WHERE (${empLookupConditions.join(" OR ")})
             ORDER BY o.created_at DESC LIMIT 20`
          )
          .bind(...empLookupParams)
          .all()) as any[];

        orders = (orderRows || []).map((r) => {
          let items: any[] = [];
          try { items = JSON.parse(r.itemsJson || "[]"); } catch {}
          return {
            id: r.id,
            displayId: r.displayId || r.id,
            total: Number(r.total) || 0,
            status: r.status || "Pending",
            time: r.time,
            createdAt: r.createdAt,
            items,
          };
        });
      } catch {}

      const totalOrders = orders.length;
      const totalAmount = orders.reduce((sum, o) => sum + (o.total || 0), 0);
      const pendingOrders = orders.filter((o) => o.status?.toLowerCase() === "pending").length;
      const deliveredOrders = orders.filter((o) => o.status?.toLowerCase() === "delivered").length;
      const cancelledOrders = orders.filter((o) => o.status?.toLowerCase() === "cancelled" || o.status?.toLowerCase() === "canceled").length;

      return c.json({
        success: true,
        details: {
          seatId: seat.seatId,
          tableId: Number(seat.tableId),
          tableName: seat.tableName || `Table ${seat.tableId}`,
          locationId: Number(seat.locationId),
          locationName: seat.locationName,
          organizationId: seat.organizationId,
          organizationName: seat.organizationName,
          shortCode,
          seatNumber: Number(seat.seatNumber),
          seatIdentifier: `SEAT-${seat.seatNumber}`,
          seatStatus: seat.seatStatus || "available",
          employeeId: seat.employeeId || null,
          employeeName: seat.employeeName || null,
          employeeEmail: seat.employeeEmail || null,
          employeeUserName: seat.employeeUserName || null,
          employeeRole: seat.employeeRole || "Employee",
          assignmentDate: seat.assignmentDate || seat.seatUpdatedAt || seat.seatCreatedAt,
          qrToken,
          orderUrl,
          orderStats: {
            totalOrders,
            totalAmount,
            pendingOrders,
            deliveredOrders,
            cancelledOrders,
          },
          recentOrders: orders,
        },
      });
    } catch (err: any) {
      console.error("getSeatDetails error:", err);
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // PATCH /api/seats/:seatId/unassign
  async unassignSeat(c: Context<AppEnv>) {
    try {
      const org = await resolveAuthorizedOrg(c);
      if (!org) {
        return c.json({ success: false, message: "Unauthorized or invalid organization context" }, 403);
      }

      const seatId = c.req.param("seatId");
      const db = getUniversalDb(c.env?.DB);

      const seat = (await db
        .prepare(`SELECT id FROM seats WHERE id = ? AND organization_id = ?`)
        .bind(seatId, org.organizationId)
        .get()) as any;

      if (!seat) {
        return c.json({ success: false, message: "Seat not found" }, 404);
      }

      const now = new Date().toISOString();
      await db
        .prepare(
          `UPDATE seats 
           SET employee_id = NULL, employee_name = NULL, employee_email = NULL, employee = NULL, status = 'available', updated_at = ? 
           WHERE id = ?`
        )
        .bind(now, seatId)
        .run();

      return c.json({ success: true, message: "Seat unassigned successfully." });
    } catch (err: any) {
      console.error("unassignSeat error:", err);
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // PATCH /api/seats/:seatId/status (Toggle available / blocked)
  async updateSeatStatus(c: Context<AppEnv>) {
    try {
      const org = await resolveAuthorizedOrg(c);
      if (!org) {
        return c.json({ success: false, message: "Unauthorized or invalid organization context" }, 403);
      }

      const seatId = c.req.param("seatId");
      const body = await c.req.json();
      const status = (body.status || "").toLowerCase();

      if (!["available", "occupied", "blocked"].includes(status)) {
        return c.json({ success: false, message: "Status must be 'available', 'occupied', or 'blocked'." }, 400);
      }

      const db = getUniversalDb(c.env?.DB);
      const now = new Date().toISOString();

      await db
        .prepare(`UPDATE seats SET status = ?, updated_at = ? WHERE id = ? AND organization_id = ?`)
        .bind(status, now, seatId, org.organizationId)
        .run();

      return c.json({ success: true, status });
    } catch (err: any) {
      console.error("updateSeatStatus error:", err);
      return c.json({ success: false, message: err.message }, 500);
    }
  },
};

