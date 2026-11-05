import { Context } from "hono";
import { getUniversalDb } from "../db";
import { AppEnv } from "../types";
import { resolveAuthorizedOrg, getAuthUser } from "../middleware/auth.middleware";
import { getNextId, generateId, generateLocationSeatId, normalizeLocationPrefix } from "../utils/id-generator";

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

export async function ensureSeatAssignmentsTable(db: any): Promise<void> {
  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS employee_seat_assignments (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        location_id TEXT NOT NULL,
        seat_id TEXT NOT NULL,
        employee_id TEXT NOT NULL,
        assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
        FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE,
        FOREIGN KEY (seat_id) REFERENCES seats(id) ON DELETE CASCADE,
        FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(location_id, seat_id),
        UNIQUE(organization_id, employee_id)
      );
      CREATE INDEX IF NOT EXISTS idx_seat_assignments_org ON employee_seat_assignments(organization_id);
      CREATE INDEX IF NOT EXISTS idx_seat_assignments_loc ON employee_seat_assignments(location_id);
      CREATE INDEX IF NOT EXISTS idx_seat_assignments_seat ON employee_seat_assignments(seat_id);
      CREATE INDEX IF NOT EXISTS idx_seat_assignments_emp ON employee_seat_assignments(employee_id);
      INSERT INTO id_sequences (scope, last_val) VALUES ('EMPLOYEE_SEAT_ASSIGNMENTS', 0)
      ON CONFLICT(scope) DO NOTHING;
    `);
  } catch {}
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
      const totalSeats = Number(body.totalSeats) || 0;
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
          const prlId = await generateId(db, "PRL");
          await db.prepare(`INSERT OR REPLACE INTO provider_locations (id, organization_id, provider_id, location_id, created_at) VALUES (?, ?, ?, ?, ?)`).run(prlId, org.organizationId, assignedProviderId, id, now);
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
          const prlId = await generateId(db, "PRL");
            await db.prepare(`INSERT OR REPLACE INTO provider_locations (id, organization_id, provider_id, location_id, created_at) VALUES (?, ?, ?, ?, ?)`).run(prlId, org.organizationId, body.assignedProviderId, targetId, now);
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
          const prlId = await generateId(db, "PRL");
          await db.prepare(`INSERT OR REPLACE INTO provider_locations (id, organization_id, provider_id, location_id, created_at) VALUES (?, ?, ?, ?, ?)`).run(prlId, org.organizationId, providerId, targetId, now);
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
      await ensureSeatAssignmentsTable(db);

      // Resolve location by id or display_id
      const loc = (await db
        .prepare(
          `SELECT l.id, l.display_id as displayId, l.name, l.short_code as shortCode, l.organization_id as organizationId, l.total_seats as totalSeats, o.short_code as orgShortCode 
           FROM locations l 
           LEFT JOIN organizations o ON l.organization_id = o.id 
           WHERE l.id = ? OR l.display_id = ?`
        )
        .bind(locId, locId)
        .get()) as any;

      if (!loc) {
        return c.json({ success: false, message: "Location not found" }, 404);
      }

      const targetLocId = loc.id;
      const effectiveShortCode = loc.shortCode || loc.orgShortCode || "FTS";
      const totalSeatsCount = Math.max(1, Number(loc.totalSeats) || 12);

      let rows: any[] = [];
      try {
        rows = (await db
          .prepare(
            `SELECT 
               s.id, 
               s.display_id as displayId, 
               s.location_id as locationId, 
               s.organization_id as organizationId,
               s.number, 
               COALESCE(u.email, s.employee_email, s.employee) as employee, 
               COALESCE(u.name, s.employee_name) as employeeName, 
               COALESCE(u.email, s.employee_email) as employeeEmail, 
               COALESCE(u.id, esa.employee_id, s.employee_id) as employeeId,
               u.user_name as employeeUserName,
               u.qr_token as employeeQrToken,
               esa.id as assignmentId,
               esa.assigned_at as assignedAt,
               s.order_url as orderUrl
             FROM seats s
             LEFT JOIN employee_seat_assignments esa ON s.id = esa.seat_id AND s.location_id = esa.location_id
             LEFT JOIN users u ON (esa.employee_id = u.id OR s.employee_id = u.id)
             WHERE s.location_id = ? OR s.location_id = ? 
             ORDER BY CAST(s.number AS INTEGER) ASC`
          )
          .bind(targetLocId, locId)
          .all()) as any[];
      } catch {
        rows = (await db
          .prepare(
            `SELECT id, display_id as displayId, location_id as locationId, organization_id as organizationId,
                    number, employee, employee_name as employeeName, employee_email as employeeEmail, employee_id as employeeId,
                    order_url as orderUrl
             FROM seats WHERE location_id = ? OR location_id = ? ORDER BY CAST(number AS INTEGER) ASC`
          )
          .bind(targetLocId, locId)
          .all()) as any[];
      }

      // Compute next candidate sequence for this location
      const locPrefix = normalizeLocationPrefix(loc.name);
      const seqRow = (await db
        .prepare(`SELECT last_val FROM id_sequences WHERE scope = ?`)
        .bind(`SEAT_LOC_${targetLocId}`)
        .get()) as any;
      let maxNum = Number(seqRow?.last_val) || 0;
      for (const r of rows) {
        const m = String(r.id || "").match(/(\d+)$/);
        if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
        const n = parseInt(r.number, 10);
        if (!isNaN(n)) maxNum = Math.max(maxNum, n);
      }
      const nextCandidateNum = maxNum + 1;
      const nextSeatId = `${locPrefix}-${String(nextCandidateNum).padStart(4, "0")}`;
      const nextSeatNumber = String(nextCandidateNum).padStart(2, "0");

      return c.json({
        success: true,
        seats: rows || [],
        nextSeatId,
        nextSeatNumber,
      });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // POST /api/locations/:id/seats (Create Seat)
  async saveSeat(c: Context<AppEnv>) {
    try {
      const org = await resolveAuthorizedOrg(c);
      if (!org) {
        return c.json({ success: false, message: "Unauthorized or invalid organization" }, 403);
      }

      const locId = c.req.param("id");
      const body = await c.req.json();
      const db = getUniversalDb(c.env?.DB);
      await ensureSeatAssignmentsTable(db);

      // Verify location belongs to authorized organization
      const loc = (await db
        .prepare(`SELECT id, display_id as displayId, name, organization_id as organizationId, total_seats as totalSeats FROM locations WHERE (id = ? OR display_id = ?) AND organization_id = ?`)
        .bind(locId, locId, org.organizationId)
        .get()) as any;

      if (!loc) {
        return c.json({ success: false, message: "Location not found in this organization" }, 404);
      }

      const effectiveLocId = loc.id;
      const orgPrefix = org.shortCode ? `/${org.shortCode}` : "";

      const locPrefix = normalizeLocationPrefix(loc.name);

      // Determine candidate sequence number and seat identifier
      let parsedNum = 0;
      if (body.number || body.seatNo) {
        const raw = String(body.number || body.seatNo).trim();
        const p = parseInt(raw, 10);
        if (!isNaN(p) && p > 0) parsedNum = p;
      }

      let candidateSeatId = body.id ? String(body.id).trim() : "";
      if (candidateSeatId && !parsedNum) {
        const m = candidateSeatId.match(/(\d+)$/);
        if (m) parsedNum = parseInt(m[1], 10);
      }

      let seatId = "";
      let number = "";

      if (!candidateSeatId || candidateSeatId.startsWith("SEA-") || !parsedNum) {
        const generated = await generateLocationSeatId(db, effectiveLocId, loc.name, parsedNum || undefined);
        seatId = generated.seatId;
        number = parsedNum ? String(parsedNum).padStart(2, "0") : generated.number;
      } else {
        if (!candidateSeatId.toUpperCase().startsWith(`${locPrefix}-`)) {
          candidateSeatId = `${locPrefix}-${String(parsedNum).padStart(4, "0")}`;
        }
        seatId = candidateSeatId;
        number = String(parsedNum).padStart(2, "0");
      }

      const displayId = seatId;

      // Check for duplicate seat number or identifier in this location
      const existingSeatRow = (await db
        .prepare(`SELECT id, display_id FROM seats WHERE location_id = ? AND (id = ? OR number = ? OR display_id = ?)`)
        .bind(effectiveLocId, seatId, number, seatId)
        .get()) as any;

      if (existingSeatRow) {
        return c.json({
          success: false,
          message: `Seat ${seatId} or seat number ${number} already exists in this location.`
        }, 409);
      }

      // Update location-scoped sequence to reflect at least this seat's sequence number
      const seqVal = parseInt(number, 10) || 1;
      await db
        .prepare(
          `INSERT INTO id_sequences (scope, last_val) VALUES (?, ?)
           ON CONFLICT(scope) DO UPDATE SET last_val = MAX(last_val, ?)`
        )
        .bind(`SEAT_LOC_${effectiveLocId}`, seqVal, seqVal)
        .run();
      const now = new Date().toISOString();
      let orderUrl = `${orgPrefix}/order/${effectiveLocId}/${parseInt(number, 10) || 1}`;

      // Employee assignment if requested
      const employeeIdentifier = body.employeeId || body.employeeEmail || body.employeeUserName || body.employee;
      let matchedUser: any = null;
      let assignmentId: string | null = null;

      if (employeeIdentifier || body.employeeName) {
        const cleanIdent = String(employeeIdentifier || body.employeeName || "").trim().toLowerCase();
        matchedUser = (await db
          .prepare(
            `SELECT u.id, u.name, u.user_name as userName, u.email, u.qr_token as qrToken
             FROM users u
             JOIN user_organizations uo ON u.id = uo.user_id
             WHERE uo.organization_id = ?
               AND (u.id = ? OR LOWER(u.email) = ? OR LOWER(u.user_name) = ? OR LOWER(u.name) = ?)
             LIMIT 1`
          )
          .bind(org.organizationId, cleanIdent, cleanIdent, cleanIdent, cleanIdent)
          .get()) as any;

        if (matchedUser) {
          // Check if already assigned to a seat in this organization
          const dupAssignment = (await db
            .prepare(
              `SELECT esa.id, s.number, s.display_id as displayId, l.name as locName 
               FROM employee_seat_assignments esa 
               JOIN seats s ON esa.seat_id = s.id 
               JOIN locations l ON s.location_id = l.id 
               WHERE esa.organization_id = ? AND esa.employee_id = ?`
            )
            .bind(org.organizationId, matchedUser.id)
            .get()) as any;

          if (dupAssignment) {
            return c.json({
              success: false,
              message: `Employee ${matchedUser.name} is already assigned to seat ${dupAssignment.number || dupAssignment.displayId} in ${dupAssignment.locName}.`,
            }, 409);
          }

          assignmentId = await generateId(db, "ESA");
          if (matchedUser.qrToken) {
            orderUrl = `${orgPrefix}/employee/${matchedUser.qrToken}`;
          }
        }
      }

      // Insert seat record
      await db
        .prepare(
          `INSERT INTO seats (id, display_id, location_id, organization_id, number, employee, employee_name, employee_email, employee_id, order_url, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          seatId,
          displayId,
          effectiveLocId,
          org.organizationId,
          number,
          matchedUser ? matchedUser.email : null,
          matchedUser ? matchedUser.name : (body.employeeName || null),
          matchedUser ? matchedUser.email : null,
          matchedUser ? matchedUser.id : null,
          orderUrl,
          now,
          now
        )
        .run();

      // If assigned, insert into employee_seat_assignments
      if (matchedUser && assignmentId) {
        await db
          .prepare(
            `INSERT INTO employee_seat_assignments (id, organization_id, location_id, seat_id, employee_id, assigned_at, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(assignmentId, org.organizationId, effectiveLocId, seatId, matchedUser.id, now, now, now)
          .run();
      }

      // Update location totalSeats counter to match actual seat count
      await db
        .prepare(`UPDATE locations SET total_seats = (SELECT COUNT(*) FROM seats WHERE location_id = ?), updated_at = ? WHERE id = ?`)
        .bind(effectiveLocId, now, effectiveLocId)
        .run();

      return c.json({
        success: true,
        message: "Seat created successfully",
        seat: {
          id: seatId,
          displayId,
          locationId: effectiveLocId,
          organizationId: org.organizationId,
          number,
          employee: matchedUser ? matchedUser.email : null,
          employeeName: matchedUser ? matchedUser.name : (body.employeeName || null),
          employeeEmail: matchedUser ? matchedUser.email : null,
          employeeId: matchedUser ? matchedUser.id : null,
          employeeUserName: matchedUser ? matchedUser.userName : null,
          employeeQrToken: matchedUser ? matchedUser.qrToken : null,
          assignmentId,
          assignedAt: assignmentId ? now : null,
          orderUrl,
        },
      });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // POST /api/locations/:id/seats/:seatId/assign (Assign Employee to Seat)
  async assignSeat(c: Context<AppEnv>) {
    try {
      const org = await resolveAuthorizedOrg(c);
      if (!org) {
        return c.json({ success: false, message: "Unauthorized or invalid organization" }, 403);
      }

      const locId = c.req.param("id");
      const seatParam = String(c.req.param("seatId") || "");
      if (!seatParam) {
        return c.json({ success: false, message: "Seat identifier is required" }, 400);
      }

      const body = await c.req.json();
      const employeeIdentifier = body.employeeId || body.employeeEmail || body.employeeUserName || body.employee || body.employeeName;
      if (!employeeIdentifier) {
        return c.json({ success: false, message: "Employee details are required for assignment" }, 400);
      }

      const db = getUniversalDb(c.env?.DB);
      await ensureSeatAssignmentsTable(db);

      // Verify location belongs to authorized organization
      const loc = (await db
        .prepare(`SELECT id, display_id as displayId, name, organization_id as organizationId FROM locations WHERE (id = ? OR display_id = ?) AND organization_id = ?`)
        .bind(locId, locId, org.organizationId)
        .get()) as any;

      if (!loc) {
        return c.json({ success: false, message: "Location not found in this organization" }, 404);
      }

      const effectiveLocId = loc.id;
      const numberMatch = seatParam.match(/(\d+)$/);
      const extractedNumber = numberMatch ? numberMatch[1].padStart(2, "0") : seatParam.padStart(2, "0");

      // Verify seat exists in D1
      let seat = (await db
        .prepare(`SELECT id, display_id as displayId, number, location_id as locationId FROM seats WHERE location_id = ? AND (id = ? OR number = ? OR display_id = ? OR number = ?)`)
        .bind(effectiveLocId, seatParam, seatParam, seatParam, extractedNumber)
        .get()) as any;

      if (!seat) {
        return c.json({ success: false, message: "Seat not found in this location" }, 404);
      }

      // Check if seat already has an active assignment
      const existingSeatAssignment = (await db
        .prepare(
          `SELECT esa.id, u.name as employeeName, u.email as employeeEmail 
           FROM employee_seat_assignments esa 
           JOIN users u ON esa.employee_id = u.id 
           WHERE esa.seat_id = ?`
        )
        .bind(seat.id)
        .get()) as any;

      // Find target employee in users table (scoped to this organization via user_organizations)
      const cleanIdent = String(employeeIdentifier).trim().toLowerCase();
      const user = (await db
        .prepare(
          `SELECT u.id, u.name, u.user_name as userName, u.email, u.qr_token as qrToken
           FROM users u
           JOIN user_organizations uo ON u.id = uo.user_id
           WHERE uo.organization_id = ?
             AND (u.id = ? OR LOWER(u.email) = ? OR LOWER(u.user_name) = ? OR LOWER(u.name) = ?)
           LIMIT 1`
        )
        .bind(org.organizationId, cleanIdent, cleanIdent, cleanIdent, cleanIdent)
        .get()) as any;

      if (!user) {
        return c.json({ success: false, message: "Employee not found in this organization" }, 404);
      }

      // Prevent duplicate assignment: Check if this employee already has an active assignment on ANOTHER seat
      const duplicateAssignment = (await db
        .prepare(
          `SELECT esa.id, esa.seat_id, s.number, s.display_id as displayId, l.name as locName 
           FROM employee_seat_assignments esa 
           JOIN seats s ON esa.seat_id = s.id 
           JOIN locations l ON s.location_id = l.id 
           WHERE esa.organization_id = ? AND esa.employee_id = ? AND esa.seat_id != ?`
        )
        .bind(org.organizationId, user.id, seat.id)
        .get()) as any;

      if (duplicateAssignment) {
        return c.json({
          success: false,
          message: `Employee ${user.name} is already assigned to seat ${duplicateAssignment.number || duplicateAssignment.displayId} in ${duplicateAssignment.locName}.`,
        }, 409);
      }

      const now = new Date().toISOString();
      const orgPrefix = org.shortCode ? `/${org.shortCode}` : "";
      const orderUrl = user.qrToken
        ? `${orgPrefix}/employee/${user.qrToken}`
        : `${orgPrefix}/order/${effectiveLocId}/${parseInt(seat.number, 10) || 1}`;

      // Upsert into employee_seat_assignments
      let assignmentId = existingSeatAssignment?.id;
      if (existingSeatAssignment) {
        await db
          .prepare(`UPDATE employee_seat_assignments SET employee_id = ?, assigned_at = ?, updated_at = ? WHERE id = ?`)
          .bind(user.id, now, now, existingSeatAssignment.id)
          .run();
      } else {
        assignmentId = await generateId(db, "ESA");
        await db
          .prepare(
            `INSERT INTO employee_seat_assignments (id, organization_id, location_id, seat_id, employee_id, assigned_at, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(seat_id) DO UPDATE SET
               employee_id = excluded.employee_id,
               assigned_at = excluded.assigned_at,
               updated_at = excluded.updated_at`
          )
          .bind(assignmentId, org.organizationId, effectiveLocId, seat.id, user.id, now, now, now)
          .run();
      }

      // Update seats table
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
        .bind(user.email, user.name, user.email, user.id, orderUrl, now, seat.id)
        .run();

      return c.json({
        success: true,
        message: `Seat ${seat.number} successfully assigned to ${user.name}.`,
        seat: {
          id: seat.id,
          displayId: seat.displayId,
          number: seat.number,
          locationId: effectiveLocId,
          organizationId: org.organizationId,
          employee: user.email,
          employeeName: user.name,
          employeeEmail: user.email,
          employeeId: user.id,
          employeeUserName: user.userName,
          employeeQrToken: user.qrToken,
          assignmentId,
          assignedAt: now,
          orderUrl,
        },
      });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // POST /api/locations/:id/seats/:seatId/unassign (Remove Employee from Seat)
  async unassignSeat(c: Context<AppEnv>) {
    try {
      const org = await resolveAuthorizedOrg(c);
      if (!org) {
        return c.json({ success: false, message: "Unauthorized or invalid organization" }, 403);
      }

      const locId = c.req.param("id");
      const seatParam = String(c.req.param("seatId") || "");
      if (!seatParam) {
        return c.json({ success: false, message: "Seat identifier is required" }, 400);
      }

      const db = getUniversalDb(c.env?.DB);

      // Verify location belongs to authorized organization
      const loc = (await db
        .prepare(`SELECT id, display_id as displayId, organization_id as organizationId FROM locations WHERE (id = ? OR display_id = ?) AND organization_id = ?`)
        .bind(locId, locId, org.organizationId)
        .get()) as any;

      if (!loc) {
        return c.json({ success: false, message: "Location not found in this organization" }, 404);
      }

      const effectiveLocId = loc.id;
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

      // Delete only the assignment record from employee_seat_assignments
      await db
        .prepare(`DELETE FROM employee_seat_assignments WHERE seat_id = ?`)
        .bind(seat.id)
        .run();

      // Clear employee information on seats table
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
          employeeUserName: null,
          employeeQrToken: null,
          assignmentId: null,
          assignedAt: null,
          orderUrl: defaultOrderUrl,
        },
      });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // DELETE /api/locations/:id/seats/:seatId (Delete Seat)
  async deleteSeat(c: Context<AppEnv>) {
    try {
      const org = await resolveAuthorizedOrg(c);
      if (!org) {
        return c.json({ success: false, message: "Unauthorized or invalid organization" }, 403);
      }

      const locId = c.req.param("id");
      const seatParam = String(c.req.param("seatId") || "");
      if (!seatParam) {
        return c.json({ success: false, message: "Seat identifier is required" }, 400);
      }
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
      const numberMatch = seatParam.match(/(\d+)$/);
      const extractedNumber = numberMatch ? numberMatch[1].padStart(2, "0") : seatParam;

      const seat = (await db
        .prepare(`SELECT id, display_id as displayId, number, employee, employee_id as employeeId FROM seats WHERE location_id = ? AND (id = ? OR number = ? OR display_id = ? OR number = ?)`)
        .bind(effectiveLocId, seatParam, seatParam, seatParam, extractedNumber)
        .get()) as any;

      if (!seat) {
        return c.json({ success: false, message: "Seat not found" }, 404);
      }

      // Check if seat has an assigned employee
      const assignment = (await db
        .prepare(`SELECT id, employee_id FROM employee_seat_assignments WHERE seat_id = ?`)
        .bind(seat.id)
        .get()) as any;

      let targetUserId = assignment?.employee_id || seat.employeeId;
      if (!targetUserId && seat.employee) {
        const u = (await db
          .prepare(`SELECT id FROM users WHERE id = ? OR email = ? OR user_name = ?`)
          .bind(seat.employee, seat.employee, seat.employee)
          .get()) as any;
        if (u) {
          targetUserId = u.id;
        }
      }

      // If seat has an assigned employee, permanently delete employee record & all related data
      if (targetUserId) {
        // 1. Delete all seat assignments for this employee
        await db
          .prepare(`DELETE FROM employee_seat_assignments WHERE employee_id = ? OR seat_id = ?`)
          .bind(targetUserId, seat.id)
          .run();

        // 2. Clear employee fields on any other seats
        await db
          .prepare(`UPDATE seats SET employee_id = NULL, employee_name = NULL, employee_email = NULL, employee = NULL WHERE employee_id = ?`)
          .bind(targetUserId)
          .run();

        // 3. Clear location provider references if any
        await db
          .prepare(`UPDATE locations SET assigned_provider_id = NULL, assigned_provider_name = NULL, assigned_provider_email = NULL WHERE assigned_provider_id = ?`)
          .bind(targetUserId)
          .run();

        // 4. Clear owner reference in organizations if matching
        await db
          .prepare(`UPDATE organizations SET owner_user_id = NULL WHERE owner_user_id = ?`)
          .bind(targetUserId)
          .run();

        // 5. Delete user sessions
        await db
          .prepare(`DELETE FROM user_sessions WHERE user_id = ?`)
          .bind(targetUserId)
          .run();

        // 6. Delete provider locations
        await db
          .prepare(`DELETE FROM provider_locations WHERE provider_id = ?`)
          .bind(targetUserId)
          .run();

        // 7. Delete ordering sessions
        await db
          .prepare(`DELETE FROM ordering_sessions WHERE employee_id = ?`)
          .bind(targetUserId)
          .run();

        // 8. Delete user organization memberships
        await db
          .prepare(`DELETE FROM user_organizations WHERE user_id = ?`)
          .bind(targetUserId)
          .run();

        // 9. Permanently delete the user from users table
        await db
          .prepare(`DELETE FROM users WHERE id = ?`)
          .bind(targetUserId)
          .run();
      } else {
        // Clean any assignment record for this seat
        await db
          .prepare(`DELETE FROM employee_seat_assignments WHERE seat_id = ?`)
          .bind(seat.id)
          .run();
      }

      // Delete the seat permanently
      await db
        .prepare(`DELETE FROM seats WHERE id = ?`)
        .bind(seat.id)
        .run();

      // Update location total_seats counter
      const now = new Date().toISOString();
      await db
        .prepare(`UPDATE locations SET total_seats = (SELECT COUNT(*) FROM seats WHERE location_id = ?), updated_at = ? WHERE id = ?`)
        .bind(effectiveLocId, now, effectiveLocId)
        .run();

      return c.json({ success: true, message: "Seat deleted successfully" });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // GET /api/locations/:id/assignments (Employee Assignment Table)
  async getAssignments(c: Context<AppEnv>) {
    try {
      const org = await resolveAuthorizedOrg(c);
      if (!org) {
        return c.json({ success: false, message: "Unauthorized or invalid organization" }, 403);
      }

      const locId = c.req.param("id");
      const db = getUniversalDb(c.env?.DB);

      // Verify location belongs to authorized organization
      const loc = (await db
        .prepare(`SELECT id, display_id as displayId, name, organization_id as organizationId FROM locations WHERE (id = ? OR display_id = ?) AND organization_id = ?`)
        .bind(locId, locId, org.organizationId)
        .get()) as any;

      if (!loc) {
        return c.json({ success: false, message: "Location not found in this organization" }, 404);
      }

      const effectiveLocId = loc.id;
      const search = (c.req.query("search") || "").trim().toLowerCase();
      const page = Math.max(1, parseInt(c.req.query("page") || "1", 10));
      const limit = Math.max(1, Math.min(100, parseInt(c.req.query("limit") || "10", 10)));
      const offset = (page - 1) * limit;

      let whereClause = `esa.location_id = ? AND esa.organization_id = ?`;
      const params: any[] = [effectiveLocId, org.organizationId];

      if (search) {
        whereClause += ` AND (
          LOWER(u.name) LIKE ? OR 
          LOWER(u.user_name) LIKE ? OR 
          LOWER(u.email) LIKE ? OR 
          LOWER(s.number) LIKE ? OR 
          LOWER(s.display_id) LIKE ? OR 
          LOWER(s.id) LIKE ?
        )`;
        const searchPattern = `%${search}%`;
        params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
      }

      // Ensure table exists defensively before querying
      await ensureSeatAssignmentsTable(db);

      let countRow: any;
      let rows: any[] = [];
      try {
        countRow = (await db
          .prepare(
            `SELECT COUNT(*) as total
             FROM employee_seat_assignments esa
             JOIN users u ON esa.employee_id = u.id
             JOIN seats s ON esa.seat_id = s.id
             WHERE ${whereClause}`
          )
          .bind(...params)
          .get()) as any;

        rows = (await db
          .prepare(
            `SELECT 
               esa.id,
               esa.assigned_at as assignedAt,
               esa.created_at as createdAt,
               u.id as employeeId,
               u.name as employeeName,
               u.user_name as userName,
               u.email,
               u.qr_token as qrToken,
               o.id as organizationId,
               o.name as organizationName,
               o.short_code as organizationShortCode,
               l.id as locationId,
               l.name as locationName,
               s.id as seatId,
               s.display_id as seatDisplayId,
               s.number as seatNumber,
               s.order_url as orderUrl
             FROM employee_seat_assignments esa
             JOIN users u ON esa.employee_id = u.id
             JOIN seats s ON esa.seat_id = s.id
             JOIN locations l ON esa.location_id = l.id
             JOIN organizations o ON esa.organization_id = o.id
             WHERE ${whereClause}
             ORDER BY esa.assigned_at DESC
             LIMIT ? OFFSET ?`
          )
          .bind(...params, limit, offset)
          .all()) as any[];
      } catch (queryErr: any) {
        if (String(queryErr?.message || "").includes("no such table: employee_seat_assignments")) {
          await ensureSeatAssignmentsTable(db);
          return c.json({
            success: true,
            assignments: [],
            total: 0,
            page,
            limit,
            totalPages: 1,
          });
        }
        throw queryErr;
      }

      const total = Number(countRow?.total) || 0;
      const totalPages = Math.max(1, Math.ceil(total / limit));

      return c.json({
        success: true,
        assignments: rows || [],
        total,
        page,
        limit,
        totalPages,
      });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // DELETE /api/locations/:id/assignments/:assignmentId
  async removeAssignment(c: Context<AppEnv>) {
    try {
      const org = await resolveAuthorizedOrg(c);
      if (!org) {
        return c.json({ success: false, message: "Unauthorized or invalid organization" }, 403);
      }

      const locId = c.req.param("id");
      const assignmentId = c.req.param("assignmentId");
      const db = getUniversalDb(c.env?.DB);
      await ensureSeatAssignmentsTable(db);

      // Verify location
      const loc = (await db
        .prepare(`SELECT id, display_id as displayId, organization_id as organizationId FROM locations WHERE (id = ? OR display_id = ?) AND organization_id = ?`)
        .bind(locId, locId, org.organizationId)
        .get()) as any;

      if (!loc) {
        return c.json({ success: false, message: "Location not found in this organization" }, 404);
      }

      const effectiveLocId = loc.id;

      // Find assignment record
      const assignment = (await db
        .prepare(`SELECT id, seat_id as seatId, employee_id as employeeId FROM employee_seat_assignments WHERE (id = ? OR seat_id = ?) AND organization_id = ?`)
        .bind(assignmentId, assignmentId, org.organizationId)
        .get()) as any;

      if (!assignment) {
        return c.json({ success: false, message: "Assignment record not found" }, 404);
      }

      // Delete the assignment record
      await db
        .prepare(`DELETE FROM employee_seat_assignments WHERE id = ?`)
        .bind(assignment.id)
        .run();

      // Clear employee information on seat
      const now = new Date().toISOString();
      const orgPrefix = org.shortCode ? `/${org.shortCode}` : "";
      
      const seat = (await db.prepare(`SELECT id, number FROM seats WHERE id = ?`).bind(assignment.seatId).get()) as any;
      const defaultOrderUrl = seat
        ? `${orgPrefix}/order/${effectiveLocId}/${parseInt(seat.number, 10) || 1}`
        : null;

      await db
        .prepare(
          `UPDATE seats 
           SET employee = NULL, 
               employee_name = NULL, 
               employee_email = NULL, 
               employee_id = NULL,
               order_url = COALESCE(?, order_url),
               updated_at = ? 
           WHERE id = ?`
        )
        .bind(defaultOrderUrl, now, assignment.seatId)
        .run();

      return c.json({
        success: true,
        message: "Employee assignment removed successfully. Seat is now available.",
      });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },
};
