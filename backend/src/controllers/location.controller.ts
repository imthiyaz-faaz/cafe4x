import { Context } from "hono";
import { getUniversalDb } from "../db";
import { AppEnv } from "../types";
import { resolveAuthorizedOrg, getAuthUser } from "../middleware/auth.middleware";
import { getNextId } from "../utils/id-generator";

export interface LocationModel {
  id: string;
  displayId?: string;
  name: string;
  status: "Active" | "Inactive";
  totalSeats: number;
  image?: string;
  organizationId?: string;
  shortCode?: string;
  assignedProviderId?: string;
  assignedProviderEmail?: string;
  assignedProviderName?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const locationController = {
  // GET /api/locations
  async getLocations(c: Context<AppEnv>) {
    try {
      const org = await resolveAuthorizedOrg(c, { allowPublic: true });
      if (!org) {
        return c.json({ success: false, message: "Organization not found or access denied" }, 403);
      }

      const db = getUniversalDb(c.env?.DB);
      const authUser = await getAuthUser(c);
      const providerId = c.req.query("providerId") || (authUser?.userType === "Provider" ? authUser.id : undefined);

      let query = `
        SELECT DISTINCT
          l.id,
          l.display_id as displayId,
          l.organization_id as organizationId,
          l.short_code as shortCode,
          l.name,
          l.status,
          l.total_seats as totalSeats,
          l.image,
          l.assigned_provider_id as assignedProviderId,
          l.assigned_provider_name as assignedProviderName,
          l.assigned_provider_email as assignedProviderEmail,
          l.created_at as createdAt,
          l.updated_at as updatedAt
        FROM locations l
      `;
      const params: any[] = [];

      // If requested by a provider, check both locations.assigned_provider_id and provider_locations table
      if (providerId) {
        query += `
          LEFT JOIN provider_locations pl ON l.id = pl.location_id
          WHERE l.organization_id = ? AND (l.assigned_provider_id = ? OR pl.provider_id = ?)
        `;
        params.push(org.organizationId, providerId, providerId);
      } else {
        query += ` WHERE l.organization_id = ?`;
        params.push(org.organizationId);
      }

      query += ` ORDER BY l.created_at DESC`;

      const rows = (await db.prepare(query).bind(...params).all()) as any[];

      const locations: LocationModel[] = (rows || []).map((r) => ({
        id: String(r.id),
        displayId: r.displayId || `LOC-${r.shortCode || org.shortCode}-${r.id}`,
        organizationId: r.organizationId || org.organizationId,
        shortCode: r.shortCode || org.shortCode,
        name: r.name,
        status: (r.status || "Active") as "Active" | "Inactive",
        totalSeats: Number(r.totalSeats) || 12,
        image: r.image || "",
        assignedProviderId: r.assignedProviderId || undefined,
        assignedProviderName: r.assignedProviderName || undefined,
        assignedProviderEmail: r.assignedProviderEmail || undefined,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }));

      return c.json({
        success: true,
        locations,
      });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // GET /api/locations/:id
  async getLocationById(c: Context<AppEnv>) {
    try {
      const id = c.req.param("id");
      const db = getUniversalDb(c.env?.DB);

      const row = (await db
        .prepare(
          `SELECT 
            id, display_id as displayId, organization_id as organizationId, short_code as shortCode,
            name, status, total_seats as totalSeats, image,
            assigned_provider_id as assignedProviderId,
            assigned_provider_name as assignedProviderName,
            assigned_provider_email as assignedProviderEmail,
            created_at as createdAt, updated_at as updatedAt
           FROM locations WHERE id = ? OR display_id = ?`
        )
        .bind(id, id)
        .get()) as any;

      if (!row) {
        return c.json({ success: false, message: "Location not found" }, 404);
      }

      return c.json({
        success: true,
        location: {
          id: String(row.id),
          displayId: row.displayId,
          organizationId: row.organizationId,
          shortCode: row.shortCode,
          name: row.name,
          status: row.status,
          totalSeats: Number(row.totalSeats) || 12,
          image: row.image || "",
          assignedProviderId: row.assignedProviderId || undefined,
          assignedProviderName: row.assignedProviderName || undefined,
          assignedProviderEmail: row.assignedProviderEmail || undefined,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        },
      });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // POST /api/locations
  async createLocation(c: Context<AppEnv>) {
    try {
      const org = await resolveAuthorizedOrg(c);
      if (!org) {
        return c.json({ success: false, message: "Unauthorized or invalid organization context" }, 403);
      }

      const body = await c.req.json();
      if (!body.name || !body.name.trim()) {
        return c.json({ success: false, message: "Location name is required" }, 400);
      }

      const db = getUniversalDb(c.env?.DB);
      const { displayId } = await getNextId(db, "LOC", org.shortCode);

      const id = body.id ? String(body.id) : displayId;
      const name = body.name.trim();
      const status = body.status || "Active";
      const totalSeats = Number(body.totalSeats) || 12;
      const image = body.image || "";
      const assignedProviderId = body.assignedProviderId || null;
      const assignedProviderName = body.assignedProviderName || null;
      const assignedProviderEmail = body.assignedProviderEmail || null;
      const now = new Date().toISOString();

      await db
        .prepare(
          `INSERT INTO locations (
            id, display_id, organization_id, short_code, name, status, total_seats, image,
            assigned_provider_id, assigned_provider_name, assigned_provider_email,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          id,
          displayId,
          org.organizationId,
          org.shortCode,
          name,
          status,
          totalSeats,
          image || null,
          assignedProviderId,
          assignedProviderName,
          assignedProviderEmail,
          now,
          now
        );

      // If provider assigned, create relation in provider_locations table
      if (assignedProviderId) {
        await db
          .prepare(
            `INSERT OR REPLACE INTO provider_locations (id, organization_id, provider_id, location_id, created_at)
             VALUES (?, ?, ?, ?, ?)`
          )
          .run(`pl_${assignedProviderId}_${id}`, org.organizationId, assignedProviderId, id, now);
      }

      const newLoc: LocationModel = {
        id,
        displayId,
        name,
        status,
        totalSeats,
        image,
        organizationId: org.organizationId,
        shortCode: org.shortCode,
        assignedProviderId: assignedProviderId || undefined,
        assignedProviderName: assignedProviderName || undefined,
        assignedProviderEmail: assignedProviderEmail || undefined,
        createdAt: now,
        updatedAt: now,
      };

      return c.json({ success: true, location: newLoc }, 201);
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // PUT /api/locations/:id
  async updateLocation(c: Context<AppEnv>) {
    try {
      const org = await resolveAuthorizedOrg(c);
      if (!org) {
        return c.json({ success: false, message: "Unauthorized or invalid organization context" }, 403);
      }

      const id = c.req.param("id");
      const body = await c.req.json();
      const now = new Date().toISOString();
      const db = getUniversalDb(c.env?.DB);

      // Verify location belongs to authorized organization
      const existing = (await db
        .prepare(`SELECT id FROM locations WHERE (id = ? OR display_id = ?) AND organization_id = ?`)
        .bind(id, id, org.organizationId)
        .get()) as any;

      if (!existing) {
        return c.json({ success: false, message: "Location not found in this organization" }, 404);
      }

      const targetId = existing.id;

      await db
        .prepare(
          `UPDATE locations
           SET 
             name = COALESCE(?, name),
             status = COALESCE(?, status),
             total_seats = COALESCE(?, total_seats),
             image = COALESCE(?, image),
             assigned_provider_id = ?,
             assigned_provider_name = ?,
             assigned_provider_email = ?,
             updated_at = ?
           WHERE id = ? AND organization_id = ?`
        )
        .run(
          body.name ? body.name.trim() : null,
          body.status || null,
          body.totalSeats ? Number(body.totalSeats) : null,
          body.image !== undefined ? body.image : null,
          body.assignedProviderId || null,
          body.assignedProviderName || null,
          body.assignedProviderEmail || null,
          now,
          targetId,
          org.organizationId
        );

      // Maintain provider_locations mapping
      if (body.assignedProviderId) {
        await db
          .prepare(
            `INSERT OR REPLACE INTO provider_locations (id, organization_id, provider_id, location_id, created_at)
             VALUES (?, ?, ?, ?, ?)`
          )
          .run(`pl_${body.assignedProviderId}_${targetId}`, org.organizationId, body.assignedProviderId, targetId, now);
      } else if (body.assignedProviderId === null || body.assignedProviderId === "") {
        await db
          .prepare(`DELETE FROM provider_locations WHERE location_id = ? AND organization_id = ?`)
          .bind(targetId, org.organizationId)
          .run();
      }

      const updated = (await db
        .prepare(`SELECT * FROM locations WHERE id = ?`)
        .bind(targetId)
        .get()) as any;

      return c.json({ success: true, location: updated });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // POST /api/locations/:id/assign
  async assignProvider(c: Context<AppEnv>) {
    try {
      const org = await resolveAuthorizedOrg(c);
      if (!org) {
        return c.json({ success: false, message: "Unauthorized or invalid organization context" }, 403);
      }

      const id = c.req.param("id");
      const body = await c.req.json();
      const now = new Date().toISOString();
      const db = getUniversalDb(c.env?.DB);

      const existing = (await db
        .prepare(`SELECT id FROM locations WHERE (id = ? OR display_id = ?) AND organization_id = ?`)
        .bind(id, id, org.organizationId)
        .get()) as any;

      if (!existing) {
        return c.json({ success: false, message: "Location not found in this organization" }, 404);
      }

      const targetId = existing.id;
      const providerId = body.assignedProviderId || null;

      await db
        .prepare(
          `UPDATE locations
           SET 
             assigned_provider_id = ?,
             assigned_provider_name = ?,
             assigned_provider_email = ?,
             updated_at = ?
           WHERE id = ? AND organization_id = ?`
        )
        .run(
          providerId,
          body.assignedProviderName || null,
          body.assignedProviderEmail || null,
          now,
          targetId,
          org.organizationId
        );

      if (providerId) {
        await db
          .prepare(
            `INSERT OR REPLACE INTO provider_locations (id, organization_id, provider_id, location_id, created_at)
             VALUES (?, ?, ?, ?, ?)`
          )
          .run(`pl_${providerId}_${targetId}`, org.organizationId, providerId, targetId, now);
      } else {
        await db
          .prepare(`DELETE FROM provider_locations WHERE location_id = ? AND organization_id = ?`)
          .bind(targetId, org.organizationId)
          .run();
      }

      const updated = (await db
        .prepare(`SELECT * FROM locations WHERE id = ?`)
        .bind(targetId)
        .get()) as any;

      return c.json({ success: true, location: updated });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // DELETE /api/locations/:id
  async deleteLocation(c: Context<AppEnv>) {
    try {
      const org = await resolveAuthorizedOrg(c);
      if (!org) {
        return c.json({ success: false, message: "Unauthorized or invalid organization context" }, 403);
      }

      const id = c.req.param("id");
      const db = getUniversalDb(c.env?.DB);

      const res = await db
        .prepare(`DELETE FROM locations WHERE (id = ? OR display_id = ?) AND organization_id = ?`)
        .bind(id, id, org.organizationId)
        .run();

      if (res.changes === 0) {
        return c.json({ success: false, message: "Location not found in this organization" }, 404);
      }

      // Also clean up provider_locations mapping
      await db.prepare(`DELETE FROM provider_locations WHERE location_id = ?`).bind(id).run();

      return c.json({ success: true, message: "Location deleted successfully" });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // GET /api/locations/:id/seats
  async getSeats(c: Context<AppEnv>) {
    try {
      const locId = c.req.param("id");
      const db = getUniversalDb(c.env?.DB);

      // Resolve location by id or display_id
      const loc = (await db
        .prepare(`SELECT id, organization_id as organizationId FROM locations WHERE id = ? OR display_id = ?`)
        .bind(locId, locId)
        .get()) as any;

      const targetLocId = loc ? loc.id : locId;

      let rows: any[] = [];
      try {
        rows = (await db
          .prepare(
            `SELECT id, display_id as displayId, location_id as locationId, organization_id as organizationId,
                    number, employee, employee_name as employeeName, employee_email as employeeEmail, employee_id as employeeId,
                    order_url as orderUrl
             FROM seats WHERE location_id = ? OR location_id = ? ORDER BY CAST(number AS INTEGER) ASC`
          )
          .bind(targetLocId, locId)
          .all()) as any[];
      } catch {
        // Fallback if employee_name/employee_email columns not yet migrated
        rows = (await db
          .prepare(
            `SELECT id, display_id as displayId, location_id as locationId, organization_id as organizationId,
                    number, employee, order_url as orderUrl
             FROM seats WHERE location_id = ? OR location_id = ? ORDER BY CAST(number AS INTEGER) ASC`
          )
          .bind(targetLocId, locId)
          .all()) as any[];
      }

      return c.json({ success: true, seats: rows || [] });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // POST /api/locations/:id/seats (Create or Update Seat with Optional Employee Assignment)
  async saveSeat(c: Context<AppEnv>) {
    try {
      const org = await resolveAuthorizedOrg(c);
      if (!org) {
        return c.json({ success: false, message: "Unauthorized or invalid organization" }, 403);
      }

      const locId = c.req.param("id");
      const body = await c.req.json();
      const rawNumber = String(body.number || body.seatNo || "").trim();
      if (!rawNumber) {
        return c.json({ success: false, message: "Seat number is required" }, 400);
      }
      const number = rawNumber.padStart(2, "0");
      const displayId = `SEAT-${org.shortCode}-${number}`;
      const seatId = body.id || `${org.shortCode}-${number}`;

      const db = getUniversalDb(c.env?.DB);

      // Verify location belongs to authorized organization
      const loc = (await db
        .prepare(`SELECT id, organization_id as organizationId FROM locations WHERE (id = ? OR display_id = ?) AND organization_id = ?`)
        .bind(locId, locId, org.organizationId)
        .get()) as any;

      if (!loc) {
        return c.json({ success: false, message: "Location not found in this organization" }, 404);
      }

      const effectiveLocId = loc.id;

      // Employee assignment fields
      const employeeName = body.employeeName ? String(body.employeeName).trim() : null;
      const employeeEmail = body.employeeEmail ? String(body.employeeEmail).trim().toLowerCase() : null;
      let employee = body.employee ? String(body.employee).trim() : null;
      if (!employee && employeeEmail) {
        employee = employeeEmail;
      }

      // Email validation if email provided
      if (employeeEmail) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(employeeEmail)) {
          return c.json({ success: false, message: "Please enter a valid employee email address." }, 400);
        }
      }

      // Check if another seat in this location already has this employee
      if (employeeEmail) {
        try {
          const duplicateAssignment = (await db
            .prepare(
              `SELECT id, number, employee, employee_email as employeeEmail 
               FROM seats 
               WHERE location_id = ? 
                 AND (LOWER(employee) = ? OR LOWER(employee_email) = ?) 
                 AND number != ?`
            )
            .bind(effectiveLocId, employeeEmail, employeeEmail, number)
            .get()) as any;

          if (duplicateAssignment) {
            return c.json({
              success: false,
              message: `Employee ${employeeEmail} is already assigned to seat ${duplicateAssignment.id || duplicateAssignment.number}.`,
            }, 409);
          }
        } catch { }
      }

      // Check if employee exists in users table and has an active qr_token
      let matchedQrToken: string | null = null;
      let matchedUserId: string | null = null;
      if (employeeEmail || employee) {
        const cleanIdent = (employeeEmail || employee || "").toLowerCase();
        try {
          const userRow = (await db
            .prepare(
              `SELECT u.id, u.name, u.email, u.qr_token as qrToken
               FROM users u
               JOIN user_organizations uo ON u.id = uo.user_id
               WHERE uo.organization_id = ?
                 AND (LOWER(u.email) = ? OR LOWER(u.name) = ?)
               LIMIT 1`
            )
            .bind(org.organizationId, cleanIdent, cleanIdent)
            .get()) as any;

          if (userRow) {
            matchedUserId = userRow.id;
            matchedQrToken = userRow.qrToken;
          }
        } catch { }
      }

      // Determine order URL (always store clean relative path without protocol or domain)
      const orgPrefix = org.shortCode ? `/${org.shortCode}` : "";
      let orderUrl = matchedQrToken
        ? `${orgPrefix}/employee/${matchedQrToken}`
        : `${orgPrefix}/order/${effectiveLocId}/${parseInt(number, 10) || 1}`;

      const now = new Date().toISOString();

      // Upsert seat record
      try {
        await db
          .prepare(
            `INSERT INTO seats (id, display_id, location_id, organization_id, number, employee, employee_name, employee_email, employee_id, order_url, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(location_id, number) DO UPDATE SET
               id = excluded.id,
               display_id = excluded.display_id,
               employee = excluded.employee,
               employee_name = excluded.employee_name,
               employee_email = excluded.employee_email,
               employee_id = excluded.employee_id,
               order_url = excluded.order_url,
               updated_at = excluded.updated_at`
          )
          .run(seatId, displayId, effectiveLocId, org.organizationId, number, employee, employeeName, employeeEmail, matchedUserId, orderUrl, now, now);
      } catch {
        // Fallback for base schema
        await db
          .prepare(
            `INSERT INTO seats (id, display_id, location_id, organization_id, number, employee, order_url, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(location_id, number) DO UPDATE SET
               id = excluded.id,
               display_id = excluded.display_id,
               employee = excluded.employee,
               order_url = excluded.order_url,
               updated_at = excluded.updated_at`
          )
          .run(seatId, displayId, effectiveLocId, org.organizationId, number, employee, orderUrl, now, now);
      }

      return c.json({
        success: true,
        seat: {
          id: seatId,
          displayId,
          locationId: effectiveLocId,
          organizationId: org.organizationId,
          number,
          employee,
          employeeName,
          employeeEmail,
          employeeId: matchedUserId,
          orderUrl,
        },
      });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // POST /api/locations/:id/seats/:seatId/unassign (Remove employee from seat WITHOUT deleting seat)
  async unassignSeat(c: Context<AppEnv>) {
    try {
      const org = await resolveAuthorizedOrg(c);
      if (!org) {
        return c.json({ success: false, message: "Unauthorized or invalid organization" }, 403);
      }

      const locId = c.req.param("id");
      const seatParam = c.req.param("seatId");
      const db = getUniversalDb(c.env?.DB);

      // Verify location belongs to authorized organization
      const loc = (await db
        .prepare(`SELECT id, organization_id as organizationId FROM locations WHERE (id = ? OR display_id = ?) AND organization_id = ?`)
        .bind(locId, locId, org.organizationId)
        .get()) as any;

      if (!loc) {
        return c.json({ success: false, message: "Location not found in this organization" }, 404);
      }

      const effectiveLocId = loc.id;

      // Extract number if seatParam is e.g. "FTS-05", "SEAT-FTS-05", or "05"
      const numberMatch = seatParam.match(/(\d+)$/);
      const extractedNumber = numberMatch ? numberMatch[1].padStart(2, "0") : seatParam;

      // Find the seat
      const seat = (await db
        .prepare(`SELECT id, display_id as displayId, number, location_id as locationId FROM seats WHERE location_id = ? AND (id = ? OR number = ? OR display_id = ? OR number = ?)`)
        .bind(effectiveLocId, seatParam, seatParam, seatParam, extractedNumber)
        .get()) as any;

      if (!seat) {
        return c.json({ success: false, message: "Seat not found in this location" }, 404);
      }

      const now = new Date().toISOString();
      const orgPrefix = org.shortCode ? `/${org.shortCode}` : "";
      const defaultOrderUrl = `${orgPrefix}/order/${effectiveLocId}/${parseInt(seat.number, 10) || 1}`;

      // Update seat assignment to NULL - keep seat, location, org, and number intact
      try {
        await db
          .prepare(
            `UPDATE seats 
             SET employee = NULL, 
                 employee_name = NULL, 
                 employee_email = NULL, 
                 employee_id = NULL,
                 order_url = ?, 
                 updated_at = ? 
             WHERE id = ?`
          )
          .bind(defaultOrderUrl, now, seat.id)
          .run();
      } catch {
        await db
          .prepare(`UPDATE seats SET employee = NULL, order_url = ?, updated_at = ? WHERE id = ?`)
          .bind(defaultOrderUrl, now, seat.id)
          .run();
      }

      return c.json({
        success: true,
        message: "Employee assignment removed successfully. Seat remains available.",
        seat: {
          id: seat.id,
          displayId: seat.displayId,
          number: seat.number,
          locationId: effectiveLocId,
          employee: null,
          employeeName: null,
          employeeEmail: null,
          employeeId: null,
          orderUrl: defaultOrderUrl,
        },
      });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // POST /api/locations/:id/seats/:seatId/assign (Assign employee to existing seat or auto-upsert)
  async assignSeat(c: Context<AppEnv>) {
    try {
      const org = await resolveAuthorizedOrg(c);
      if (!org) {
        return c.json({ success: false, message: "Unauthorized or invalid organization" }, 403);
      }

      const locId = c.req.param("id");
      const seatParam = c.req.param("seatId");
      const body = await c.req.json();

      const employeeName = body.employeeName ? String(body.employeeName).trim() : null;
      const employeeEmail = body.employeeEmail ? String(body.employeeEmail).trim().toLowerCase() : null;
      let employee = body.employee ? String(body.employee).trim() : null;
      if (!employee && employeeEmail) {
        employee = employeeEmail;
      }

      if (!employee && !employeeEmail && !employeeName) {
        return c.json({ success: false, message: "Employee details are required for assignment" }, 400);
      }

      if (employeeEmail) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(employeeEmail)) {
          return c.json({ success: false, message: "Please provide a valid employee email address." }, 400);
        }
      }

      const db = getUniversalDb(c.env?.DB);

      // Verify location belongs to authorized organization
      const loc = (await db
        .prepare(`SELECT id, display_id as displayId, total_seats as totalSeats, organization_id as organizationId FROM locations WHERE (id = ? OR display_id = ?) AND organization_id = ?`)
        .bind(locId, locId, org.organizationId)
        .get()) as any;

      if (!loc) {
        return c.json({ success: false, message: "Location not found in this organization" }, 404);
      }

      const effectiveLocId = loc.id;

      // Extract seat number from seatParam e.g. "FTS-05", "SEAT-FTS-05", or "05"
      const numberMatch = seatParam.match(/(\d+)$/);
      const extractedNumber = numberMatch ? numberMatch[1].padStart(2, "0") : seatParam.padStart(2, "0");

      // Verify if seat exists in D1
      let seat = (await db
        .prepare(`SELECT id, display_id as displayId, number, location_id as locationId FROM seats WHERE location_id = ? AND (id = ? OR number = ? OR display_id = ? OR number = ?)`)
        .bind(effectiveLocId, seatParam, seatParam, seatParam, extractedNumber)
        .get()) as any;

      const now = new Date().toISOString();

      // If seat not found, auto-upsert it for this location (handles virtual/un-seeded seats)
      if (!seat) {
        const generatedSeatId = `${org.shortCode}-${extractedNumber}`;
        const generatedDisplayId = `SEAT-${org.shortCode}-${extractedNumber}`;
        const orgPrefix = org.shortCode ? `/${org.shortCode}` : "";
        const defaultOrderUrl = `${orgPrefix}/order/${effectiveLocId}/${parseInt(extractedNumber, 10) || 1}`;

        try {
          await db
            .prepare(
              `INSERT INTO seats (id, display_id, location_id, organization_id, number, order_url, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(location_id, number) DO UPDATE SET updated_at = excluded.updated_at`
            )
            .bind(generatedSeatId, generatedDisplayId, effectiveLocId, org.organizationId, extractedNumber, defaultOrderUrl, now, now)
            .run();

          seat = {
            id: generatedSeatId,
            displayId: generatedDisplayId,
            number: extractedNumber,
            locationId: effectiveLocId,
          };
        } catch (e: any) {
          // If already inserted concurrently, re-fetch
          seat = (await db
            .prepare(`SELECT id, display_id as displayId, number, location_id as locationId FROM seats WHERE location_id = ? AND number = ?`)
            .bind(effectiveLocId, extractedNumber)
            .get()) as any;
        }
      }

      if (!seat) {
        return c.json({ success: false, message: "Seat not found in this location" }, 404);
      }

      // Check if employee is already assigned to a different seat in this location
      if (employeeEmail) {
        try {
          const duplicate = (await db
            .prepare(
              `SELECT id, number, employee, employee_email as employeeEmail 
               FROM seats 
               WHERE location_id = ? 
                 AND (LOWER(employee) = ? OR LOWER(employee_email) = ?) 
                 AND id != ? AND number != ?`
            )
            .bind(effectiveLocId, employeeEmail, employeeEmail, seat.id, seat.number)
            .get()) as any;

          if (duplicate) {
            return c.json({
              success: false,
              message: `Employee ${employeeEmail} is already assigned to seat ${duplicate.id || duplicate.number}.`,
            }, 409);
          }
        } catch { }
      }

      // Check if employee exists in users table and has an active qr_token
      let matchedQrToken: string | null = null;
      let matchedUserId: string | null = null;
      if (employeeEmail || employee) {
        const cleanIdent = (employeeEmail || employee || "").toLowerCase();
        try {
          const userRow = (await db
            .prepare(
              `SELECT u.id, u.name, u.email, u.qr_token as qrToken
               FROM users u
               JOIN user_organizations uo ON u.id = uo.user_id
               WHERE uo.organization_id = ?
                 AND (LOWER(u.email) = ? OR LOWER(u.name) = ?)
               LIMIT 1`
            )
            .bind(org.organizationId, cleanIdent, cleanIdent)
            .get()) as any;

          if (userRow) {
            matchedUserId = userRow.id;
            matchedQrToken = userRow.qrToken;
          }
        } catch { }
      }

      const orgPrefix = org.shortCode ? `/${org.shortCode}` : "";
      let orderUrl = matchedQrToken
        ? `${orgPrefix}/employee/${matchedQrToken}`
        : `${orgPrefix}/order/${effectiveLocId}/${parseInt(seat.number, 10) || 1}`;

      try {
        await db
          .prepare(
            `UPDATE seats 
             SET employee = ?, 
                 employee_name = ?, 
                 employee_email = ?, 
                 employee_id = ?, 
                 order_url = ?, 
                 updated_at = ? 
             WHERE id = ?`
          )
          .bind(employee, employeeName, employeeEmail, matchedUserId, orderUrl, now, seat.id)
          .run();
      } catch {
        await db
          .prepare(`UPDATE seats SET employee = ?, order_url = ?, updated_at = ? WHERE id = ?`)
          .bind(employee, orderUrl, now, seat.id)
          .run();
      }

      return c.json({
        success: true,
        message: "Employee assigned to seat successfully.",
        seat: {
          id: seat.id,
          displayId: seat.displayId,
          number: seat.number,
          locationId: effectiveLocId,
          employee,
          employeeName,
          employeeEmail,
          employeeId: matchedUserId,
          orderUrl,
        },
      });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // DELETE /api/locations/:id/seats/:seatId (Delete seat record)
  async deleteSeat(c: Context<AppEnv>) {
    try {
      const org = await resolveAuthorizedOrg(c);
      if (!org) {
        return c.json({ success: false, message: "Unauthorized or invalid organization" }, 403);
      }

      const locId = c.req.param("id");
      const seatParam = c.req.param("seatId");
      const db = getUniversalDb(c.env?.DB);

      // Verify location belongs to authorized organization
      const loc = (await db
        .prepare(`SELECT id, organization_id as organizationId FROM locations WHERE (id = ? OR display_id = ?) AND organization_id = ?`)
        .bind(locId, locId, org.organizationId)
        .get()) as any;

      const effectiveLocId = loc ? loc.id : locId;

      const numberMatch = seatParam.match(/(\d+)$/);
      const extractedNumber = numberMatch ? numberMatch[1].padStart(2, "0") : seatParam;

      const res = await db
        .prepare(`DELETE FROM seats WHERE location_id = ? AND (id = ? OR number = ? OR display_id = ? OR number = ?)`)
        .bind(effectiveLocId, seatParam, seatParam, seatParam, extractedNumber)
        .run();

      if (res.changes === 0) {
        return c.json({ success: false, message: "Seat not found" }, 404);
      }

      return c.json({ success: true, message: "Seat deleted successfully" });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },
};
