import { Context } from "hono";
import { getUniversalDb } from "../db";
import { AppEnv } from "../types";
import { resolveAuthorizedOrg, getAuthUser } from "../middleware/auth.middleware";
import { getNextId, generateId, generateLocationSeatId, normalizeLocationPrefix, generateSeatQrToken } from "../utils/id-generator";

export interface LocationProviderSummary {
  id: string;
  name: string;
  email: string;
  userName?: string;
}

export interface LocationModel {
  id: string;
  displayId?: string;
  name: string;
  status: "Active" | "Inactive";
  totalSeats: number;
  tableLimit?: number;
  image?: string;
  organizationId?: string;
  shortCode?: string;
  assignedProviderId?: string;
  assignedProviderEmail?: string;
  assignedProviderName?: string;
  assignedProviders?: LocationProviderSummary[];
  assignedProvidersCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export async function ensureLocationProvidersTable(db: any): Promise<void> {
  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS location_providers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id TEXT NOT NULL,
        location_id INTEGER NOT NULL,
        provider_id TEXT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE,
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
        FOREIGN KEY (provider_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(location_id, provider_id)
      );
      CREATE INDEX IF NOT EXISTS idx_loc_prov_loc_id ON location_providers(location_id);
      CREATE INDEX IF NOT EXISTS idx_loc_prov_prov_id ON location_providers(provider_id);
      CREATE INDEX IF NOT EXISTS idx_loc_prov_org_id ON location_providers(organization_id);
    `);
    try {
      await db.exec(`ALTER TABLE tables ADD COLUMN provider_id TEXT;`);
    } catch {}
    try {
      await db.exec(`ALTER TABLE location_tables ADD COLUMN provider_id TEXT;`);
    } catch {}
  } catch {}
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

    // Ensure qr_token exists on seats table
    try {
      await db.exec(`ALTER TABLE seats ADD COLUMN qr_token TEXT;`);
    } catch {}
    try {
      await db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_seats_qr_token ON seats(qr_token);`);
    } catch {}
    // Ensure seat_id exists on orders table
    try {
      await db.exec(`ALTER TABLE orders ADD COLUMN seat_id TEXT;`);
    } catch {}
    try {
      await db.exec(`CREATE INDEX IF NOT EXISTS idx_orders_seat_id ON orders(seat_id);`);
    } catch {}
  } catch {}
}

export const locationController = {
  // GET /api/locations/check-name?name=xyz&excludeLocationId=LOC-xxx
  async checkLocationName(c: Context<AppEnv>) {
    try {
      const org = await resolveAuthorizedOrg(c);
      if (!org) {
        return c.json({ success: false, available: false, message: "Unauthorized or invalid organization context" }, 403);
      }

      const name = (c.req.query("name") || "").trim();
      const excludeLocationId = (c.req.query("excludeLocationId") || "").trim();

      if (!name) {
        return c.json({ success: false, available: false, message: "Location name is required" }, 400);
      }

      const db = getUniversalDb(c.env?.DB);

      let query = `SELECT id, name FROM locations WHERE organization_id = ? AND LOWER(TRIM(name)) = LOWER(TRIM(?))`;
      const params: any[] = [org.organizationId, name];

      if (excludeLocationId) {
        query += ` AND id != ? AND display_id != ?`;
        params.push(excludeLocationId, excludeLocationId);
      }

      const existing = (await db.prepare(query).bind(...params).get()) as any;

      if (existing) {
        return c.json({
          success: true,
          available: false,
          message: "This location name already exists in this organization.",
        });
      }

      return c.json({
        success: true,
        available: true,
        message: "Location name is available.",
      });
    } catch (err: any) {
      console.error("checkLocationName error:", err);
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // GET /api/locations/:id/seats/check-employee-email?email=xxx
  async checkEmployeeEmail(c: Context<AppEnv>) {
    try {
      const org = await resolveAuthorizedOrg(c);
      if (!org) {
        return c.json({ success: false, available: false, message: "Unauthorized or invalid organization context" }, 403);
      }

      const locId = c.req.param("id");
      const email = (c.req.query("email") || "").trim().toLowerCase();
      const excludeSeatId = (c.req.query("excludeSeatId") || "").trim();

      if (!email) {
        return c.json({ success: false, available: false, message: "Employee email is required." }, 400);
      }

      const db = getUniversalDb(c.env?.DB);

      // Verify location belongs to authorized organization
      const loc = (await db
        .prepare(`SELECT id, name FROM locations WHERE (id = ? OR display_id = ?) AND organization_id = ?`)
        .bind(locId, locId, org.organizationId)
        .get()) as any;

      if (!loc) {
        return c.json({ success: false, available: false, message: "Location not found in this organization" }, 404);
      }

      const effectiveLocId = loc.id;

      let query = `
        SELECT id, display_id as displayId, number, employee_email, employee
        FROM seats
        WHERE organization_id = ? AND location_id = ?
          AND (
            (employee_email IS NOT NULL AND LOWER(TRIM(employee_email)) = ?)
            OR
            (employee IS NOT NULL AND LOWER(TRIM(employee)) = ?)
          )
      `;
      const params: any[] = [org.organizationId, effectiveLocId, email, email];

      if (excludeSeatId) {
        query += ` AND id != ? AND display_id != ?`;
        params.push(excludeSeatId, excludeSeatId);
      }

      const existingSeat = (await db.prepare(query).bind(...params).get()) as any;

      if (existingSeat) {
        return c.json({
          success: true,
          available: false,
          message: "This employee email is already assigned to a seat in this location.",
        });
      }

      return c.json({
        success: true,
        available: true,
        message: "Email available.",
      });
    } catch (err: any) {
      console.error("checkEmployeeEmail error:", err);
      return c.json({ success: false, available: false, message: err.message }, 500);
    }
  },

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

      // If requested by a provider, check locations.assigned_provider_id, location_providers and provider_locations table
      if (providerId) {
        query += `
          LEFT JOIN provider_locations pl ON l.id = pl.location_id
          LEFT JOIN location_providers lp ON l.id = lp.location_id
          WHERE l.organization_id = ? AND (l.assigned_provider_id = ? OR pl.provider_id = ? OR lp.provider_id = ?)
        `;
        params.push(org.organizationId, providerId, providerId, providerId);
      } else {
        query += ` WHERE l.organization_id = ?`;
        params.push(org.organizationId);
      }

      query += ` ORDER BY l.created_at DESC`;

      const rows = (await db.prepare(query).bind(...params).all()) as any[];

      // Fetch all assigned providers for these locations from location_providers / provider_locations
      let locProvidersMap: Record<string, LocationProviderSummary[]> = {};
      try {
        const provRows = (await db.prepare(`
          SELECT 
            lp.location_id as locationId,
            u.id,
            u.name,
            u.email,
            u.user_name as userName
          FROM location_providers lp
          JOIN users u ON lp.provider_id = u.id
          WHERE lp.organization_id = ?
          ORDER BY u.name ASC
        `).bind(org.organizationId).all()) as any[];

        (provRows || []).forEach((pr: any) => {
          const lId = String(pr.locationId);
          if (!locProvidersMap[lId]) locProvidersMap[lId] = [];
          if (!locProvidersMap[lId].some((p) => p.id === pr.id)) {
            locProvidersMap[lId].push({
              id: String(pr.id),
              name: pr.name || pr.userName || pr.email,
              email: pr.email,
              userName: pr.userName,
            });
          }
        });
      } catch (errProv) {
        // Fallback or empty
      }

      const locations: LocationModel[] = (rows || []).map((r) => {
        const lId = String(r.id);
        const assignedList = locProvidersMap[lId] || [];
        // If assignedList is empty but location has assigned_provider_id, include it
        if (assignedList.length === 0 && r.assignedProviderId) {
          assignedList.push({
            id: String(r.assignedProviderId),
            name: r.assignedProviderName || "Assigned Provider",
            email: r.assignedProviderEmail || "",
          });
        }

        return {
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
          assignedProviders: assignedList,
          assignedProvidersCount: assignedList.length,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        };
      });

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
      const org = await resolveAuthorizedOrg(c);
      if (!org) {
        return c.json({ success: false, message: "Unauthorized or invalid organization context" }, 403);
      }

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
           FROM locations WHERE (id = ? OR display_id = ?) AND organization_id = ?`
        )
        .bind(id, id, org.organizationId)
        .get()) as any;

      if (!row) {
        return c.json({ success: false, message: "Location not found in this organization" }, 404);
      }

      // Fetch assigned providers for this location
      let assignedProviders: LocationProviderSummary[] = [];
      try {
        const provRows = (await db.prepare(`
          SELECT 
            u.id,
            u.name,
            u.email,
            u.user_name as userName
          FROM location_providers lp
          JOIN users u ON lp.provider_id = u.id
          WHERE lp.location_id = ? AND lp.organization_id = ?
          ORDER BY u.name ASC
        `).bind(row.id, org.organizationId).all()) as any[];

        assignedProviders = (provRows || []).map((p: any) => ({
          id: String(p.id),
          name: p.name || p.userName || p.email,
          email: p.email,
          userName: p.userName,
        }));
      } catch (errProv) {}

      if (assignedProviders.length === 0 && row.assignedProviderId) {
        assignedProviders.push({
          id: String(row.assignedProviderId),
          name: row.assignedProviderName || "Assigned Provider",
          email: row.assignedProviderEmail || "",
        });
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
          tableLimit: Number(row.table_limit) || 5,
          image: row.image || "",
          assignedProviderId: row.assignedProviderId || undefined,
          assignedProviderName: row.assignedProviderName || undefined,
          assignedProviderEmail: row.assignedProviderEmail || undefined,
          assignedProviders,
          assignedProvidersCount: assignedProviders.length,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        },
      });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // GET /api/locations/:id/statistics
  async getLocationStatistics(c: Context<AppEnv>) {
    try {
      const org = await resolveAuthorizedOrg(c, { allowPublic: true });
      if (!org) {
        return c.json({ success: false, message: "Unauthorized or invalid organization context" }, 403);
      }

      const id = c.req.param("id");
      const db = getUniversalDb(c.env?.DB);

      // Support environments where table_limit might or might not be in locations
      let loc: any = null;
      try {
        loc = await db
          .prepare(`SELECT id, name, table_limit, total_seats FROM locations WHERE (id = ? OR display_id = ?) AND organization_id = ?`)
          .bind(id, id, org.organizationId)
          .get();
      } catch (e: any) {
        loc = await db
          .prepare(`SELECT id, name, total_seats FROM locations WHERE (id = ? OR display_id = ?) AND organization_id = ?`)
          .bind(id, id, org.organizationId)
          .get();
      }

      if (!loc) {
        return c.json({ success: false, message: "Location not found in this organization" }, 404);
      }

      const effectiveLocId = loc.id;

      // Dynamic statistics from location_tables / tables and location_table_seats / seats
      let totalTables = 0;
      try {
        const countRow = (await db
          .prepare(`SELECT COUNT(*) as cnt FROM location_tables WHERE location_id = ?`)
          .bind(effectiveLocId)
          .get()) as any;
        totalTables = Number(countRow?.cnt) || 0;
      } catch {
        try {
          const countRow = (await db
            .prepare(`SELECT COUNT(*) as cnt FROM tables WHERE location_id = ?`)
            .bind(effectiveLocId)
            .get()) as any;
          totalTables = Number(countRow?.cnt) || 0;
        } catch {}
      }

      let totalSeats = 0;
      let occupiedSeats = 0;
      let availableSeats = 0;
      let inactiveSeats = 0;

      try {
        const seatStatsRow = (await db
          .prepare(
            `SELECT 
               COUNT(*) as totalSeats,
               COUNT(CASE WHEN status = 'occupied' OR (employee_id IS NOT NULL AND employee_id != '') OR (employee_email IS NOT NULL AND employee_email != '') THEN 1 END) as occupiedSeats,
               COUNT(CASE WHEN status = 'available' AND (employee_id IS NULL OR employee_id = '') AND (employee_email IS NULL OR employee_email = '') THEN 1 END) as availableSeats,
               COUNT(CASE WHEN status = 'inactive' OR status = 'blocked' THEN 1 END) as inactiveSeats
             FROM location_table_seats
             WHERE location_id = ?`
          )
          .bind(effectiveLocId)
          .get()) as any;

        totalSeats = Number(seatStatsRow?.totalSeats) || 0;
        occupiedSeats = Number(seatStatsRow?.occupiedSeats) || 0;
        availableSeats = Number(seatStatsRow?.availableSeats) || 0;
        inactiveSeats = Number(seatStatsRow?.inactiveSeats) || 0;
      } catch {
        try {
          const seatStatsRow = (await db
            .prepare(
              `SELECT 
                 COUNT(*) as totalSeats,
                 COUNT(CASE WHEN status = 'occupied' OR (employee_id IS NOT NULL AND employee_id != '') OR (employee_email IS NOT NULL AND employee_email != '') OR (employee IS NOT NULL AND employee != '') THEN 1 END) as occupiedSeats,
                 COUNT(CASE WHEN (status = 'available' OR status IS NULL) AND (employee_id IS NULL OR employee_id = '') AND (employee_email IS NULL OR employee_email = '') AND (employee IS NULL OR employee = '') THEN 1 END) as availableSeats,
                 COUNT(CASE WHEN status = 'blocked' OR status = 'inactive' THEN 1 END) as inactiveSeats
               FROM seats
               WHERE location_id = ?`
            )
            .bind(effectiveLocId)
            .get()) as any;

          totalSeats = Number(seatStatsRow?.totalSeats) || 0;
          occupiedSeats = Number(seatStatsRow?.occupiedSeats) || 0;
          availableSeats = Number(seatStatsRow?.availableSeats) || 0;
          inactiveSeats = Number(seatStatsRow?.inactiveSeats) || 0;
        } catch {}
      }

      if (availableSeats === 0 && totalSeats > 0 && occupiedSeats < totalSeats) {
        availableSeats = Math.max(0, totalSeats - occupiedSeats - inactiveSeats);
      }
      const occupancyPercentage = totalSeats > 0 ? Math.round((occupiedSeats / totalSeats) * 100) : 0;

      return c.json({
        success: true,
        statistics: {
          totalTables,
          totalSeats,
          occupiedSeats,
          availableSeats,
          inactiveSeats,
          occupancyPercentage,
          tableLimit: Number(loc?.table_limit) || 5,
        },
      });
    } catch (err: any) {
      console.error("getLocationStatistics error:", err);
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
      const name = body.name.trim();

      // Validate location name uniqueness within this organization (case-insensitive & trimmed)
      const existingNameRow = (await db
        .prepare(`SELECT id FROM locations WHERE organization_id = ? AND LOWER(TRIM(name)) = LOWER(TRIM(?))`)
        .bind(org.organizationId, name)
        .get()) as any;

      if (existingNameRow) {
        return c.json({
          success: false,
          message: "This location name already exists in this organization.",
        }, 409);
      }

      const status = body.status || "Active";
      const totalSeats = Number(body.totalSeats) || 0;
      const image = body.image || "";
      const assignedProviderId = body.assignedProviderId || null;
      const assignedProviderName = body.assignedProviderName || null;
      const assignedProviderEmail = body.assignedProviderEmail || null;
      const now = new Date().toISOString();

      // Let D1 generate the integer auto-increment ID
      const insertRow = (await db
        .prepare(
          `INSERT INTO locations (
            organization_id, short_code, name, status, total_seats, image,
            assigned_provider_id, assigned_provider_name, assigned_provider_email,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`
        )
        .bind(
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
        )
        .get()) as any;

      let generatedNumericId: number | string = insertRow?.id;
      if (!generatedNumericId) {
        // Fallback for run() if RETURNING not returned in custom wrapper
        const runRes = await db.prepare("SELECT MAX(id) as maxId FROM locations WHERE organization_id = ?").bind(org.organizationId).get() as any;
        generatedNumericId = runRes?.maxId || 1;
      }

      const id = String(generatedNumericId);
      const displayId = id;

      // Ensure display_id matches the generated numeric ID
      await db
        .prepare(`UPDATE locations SET display_id = ? WHERE id = ?`)
        .bind(displayId, generatedNumericId)
        .run();

      // If provider assigned, create relation in provider_locations table
      if (assignedProviderId) {
        const prlId = await generateId(db, "PRL");
        await db
          .prepare(
            `INSERT OR REPLACE INTO provider_locations (id, organization_id, provider_id, location_id, created_at)
             VALUES (?, ?, ?, ?, ?)`
          )
          .bind(prlId, org.organizationId, assignedProviderId, id, now)
          .run();
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

      if (body.name !== undefined && body.name !== null) {
        const trimmedName = String(body.name).trim();
        if (!trimmedName) {
          return c.json({ success: false, message: "Location name cannot be empty" }, 400);
        }

        // Validate location name uniqueness within this organization (excluding current record)
        const dupNameRow = (await db
          .prepare(
            `SELECT id FROM locations 
             WHERE organization_id = ? 
               AND LOWER(TRIM(name)) = LOWER(TRIM(?))
               AND id != ? AND display_id != ?`
          )
          .bind(org.organizationId, trimmedName, targetId, targetId)
          .get()) as any;

        if (dupNameRow) {
          return c.json({
            success: false,
            message: "This location name already exists in this organization.",
          }, 409);
        }
      }

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
      await ensureLocationProvidersTable(db);

      const existing = (await db
        .prepare(`SELECT id FROM locations WHERE (id = ? OR display_id = ?) AND organization_id = ?`)
        .bind(id, id, org.organizationId)
        .get()) as any;

      if (!existing) {
        return c.json({ success: false, message: "Location not found in this organization" }, 404);
      }

      const targetId = Number(existing.id);

      // Support both single provider and multiple provider IDs (e.g. providerIds: string[])
      let providerIds: string[] = [];
      if (Array.isArray(body.providerIds)) {
        providerIds = body.providerIds.map((p: any) => String(p).trim()).filter(Boolean);
      } else if (body.assignedProviderId) {
        providerIds = [String(body.assignedProviderId).trim()];
      }

      // Validate all providers exist and belong to the same organization and are Providers
      const validProviders: any[] = [];
      for (const pId of providerIds) {
        const u = (await db
          .prepare(`
            SELECT u.id, u.name, u.email, u.user_name
            FROM users u
            JOIN user_organizations uo ON u.id = uo.user_id
            WHERE u.id = ? AND uo.organization_id = ? AND LOWER(u.user_type) = 'provider'
          `)
          .bind(pId, org.organizationId)
          .get()) as any;

        if (!u) {
          return c.json({
            success: false,
            message: `Provider ID '${pId}' is invalid or does not belong to this organization.`,
          }, 400);
        }
        validProviders.push(u);
      }

      // Check for tables in this location that were assigned to providers being removed
      const removedProvidersCheck = (await db
        .prepare(`
          SELECT lp.provider_id
          FROM location_providers lp
          WHERE lp.location_id = ? AND lp.organization_id = ?
        `)
        .bind(targetId, org.organizationId)
        .all()) as any[];

      const currentAssignedIds = (removedProvidersCheck || []).map((r: any) => String(r.provider_id));
      const newlyAssignedSet = new Set(validProviders.map((vp) => String(vp.id)));
      const removedIds = currentAssignedIds.filter((cid) => !newlyAssignedSet.has(cid));

      if (removedIds.length > 0) {
        // Tables currently assigned to removed providers must be unassigned safely
        for (const remId of removedIds) {
          try {
            await db
              .prepare(`UPDATE tables SET provider_id = NULL, updated_at = ? WHERE location_id = ? AND provider_id = ?`)
              .bind(now, targetId, remId)
              .run();
          } catch {}
          try {
            await db
              .prepare(`UPDATE location_tables SET provider_id = NULL, updated_at = ? WHERE location_id = ? AND provider_id = ?`)
              .bind(now, targetId, remId)
              .run();
          } catch {}
        }
      }

      // Sync location_providers table
      await db
        .prepare(`DELETE FROM location_providers WHERE location_id = ? AND organization_id = ?`)
        .bind(targetId, org.organizationId)
        .run();

      for (const prov of validProviders) {
        await db
          .prepare(
            `INSERT OR IGNORE INTO location_providers (organization_id, location_id, provider_id, created_at)
             VALUES (?, ?, ?, ?)`
          )
          .bind(org.organizationId, targetId, prov.id, now)
          .run();

        // Also mirror into legacy provider_locations for full backward compatibility
        try {
          const prlId = await generateId(db, "PRL");
          await db
            .prepare(`INSERT OR REPLACE INTO provider_locations (id, organization_id, provider_id, location_id, created_at) VALUES (?, ?, ?, ?, ?)`)
            .run(prlId, org.organizationId, prov.id, targetId, now);
        } catch {}
      }

      // Update primary location record's assigned_provider_* with first provider or null
      const primaryProv = validProviders[0] || null;
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
          primaryProv?.id || null,
          primaryProv?.name || null,
          primaryProv?.email || null,
          now,
          targetId,
          org.organizationId
        );

      // Return updated location with full assignedProviders array
      const updated = (await db
        .prepare(`SELECT * FROM locations WHERE id = ?`)
        .bind(targetId)
        .get()) as any;

      return c.json({
        success: true,
        message: "Location providers updated successfully",
        location: {
          ...updated,
          assignedProviders: validProviders.map((vp) => ({
            id: String(vp.id),
            name: vp.name || vp.user_name || vp.email,
            email: vp.email,
            userName: vp.user_name,
          })),
          assignedProvidersCount: validProviders.length,
        },
      });
    } catch (err: any) {
      console.error("assignProvider error:", err);
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // GET /api/locations/:id/providers
  async getLocationProviders(c: Context<AppEnv>) {
    try {
      const org = await resolveAuthorizedOrg(c, { allowPublic: true });
      if (!org) {
        return c.json({ success: false, message: "Unauthorized or invalid organization context" }, 403);
      }

      const id = c.req.param("id");
      const db = getUniversalDb(c.env?.DB);
      await ensureLocationProvidersTable(db);

      const loc = (await db
        .prepare(`SELECT id, name, organization_id, assigned_provider_id, assigned_provider_name, assigned_provider_email FROM locations WHERE (id = ? OR display_id = ?) AND organization_id = ?`)
        .bind(id, id, org.organizationId)
        .get()) as any;

      if (!loc) {
        return c.json({ success: false, message: "Location not found in this organization" }, 404);
      }

      const targetId = Number(loc.id);

      // Query from location_providers
      let providers: any[] = [];
      try {
        providers = (await db
          .prepare(`
            SELECT 
              u.id,
              u.name,
              u.email,
              u.user_name as userName,
              u.user_type as userType
            FROM location_providers lp
            JOIN users u ON lp.provider_id = u.id
            WHERE lp.location_id = ? AND lp.organization_id = ?
            ORDER BY u.name ASC
          `)
          .bind(targetId, org.organizationId)
          .all()) as any[];
      } catch {}

      // Fallback if location_providers has no rows but locations has assigned_provider_id
      if ((!providers || providers.length === 0) && loc.assigned_provider_id) {
        const single = (await db
          .prepare(`SELECT id, name, email, user_name as userName, user_type as userType FROM users WHERE id = ?`)
          .bind(loc.assigned_provider_id)
          .get()) as any;
        if (single) providers = [single];
      }

      return c.json({
        success: true,
        locationId: targetId,
        providers: (providers || []).map((p: any) => ({
          id: String(p.id),
          name: p.name || p.userName || p.email,
          email: p.email,
          userName: p.userName,
          userType: p.userType || "Provider",
        })),
      });
    } catch (err: any) {
      console.error("getLocationProviders error:", err);
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // DELETE /api/locations/:id/providers/:providerId
  async removeProviderFromLocation(c: Context<AppEnv>) {
    try {
      const org = await resolveAuthorizedOrg(c);
      if (!org) {
        return c.json({ success: false, message: "Unauthorized or invalid organization context" }, 403);
      }

      const locationId = c.req.param("id");
      const providerId = c.req.param("providerId");
      const db = getUniversalDb(c.env?.DB);
      const now = new Date().toISOString();

      const loc = (await db
        .prepare(`SELECT id FROM locations WHERE (id = ? OR display_id = ?) AND organization_id = ?`)
        .bind(locationId, locationId, org.organizationId)
        .get()) as any;

      if (!loc) {
        return c.json({ success: false, message: "Location not found in this organization" }, 404);
      }

      const targetId = Number(loc.id);

      // Remove from location_providers
      await db
        .prepare(`DELETE FROM location_providers WHERE location_id = ? AND provider_id = ? AND organization_id = ?`)
        .bind(targetId, providerId, org.organizationId)
        .run();

      try {
        await db
          .prepare(`DELETE FROM provider_locations WHERE location_id = ? AND provider_id = ? AND organization_id = ?`)
          .bind(targetId, providerId, org.organizationId)
          .run();
      } catch {}

      // Handle table assignments safely: unassign tables in this location that were assigned to this provider
      try {
        await db
          .prepare(`UPDATE tables SET provider_id = NULL, updated_at = ? WHERE location_id = ? AND provider_id = ?`)
          .bind(now, targetId, providerId)
          .run();
      } catch {}
      try {
        await db
          .prepare(`UPDATE location_tables SET provider_id = NULL, updated_at = ? WHERE location_id = ? AND provider_id = ?`)
          .bind(now, targetId, providerId)
          .run();
      } catch {}

      // If location.assigned_provider_id was this provider, reassign to next available provider or null
      const nextRemaining = (await db
        .prepare(`
          SELECT lp.provider_id, u.name, u.email
          FROM location_providers lp
          JOIN users u ON lp.provider_id = u.id
          WHERE lp.location_id = ? AND lp.organization_id = ?
          LIMIT 1
        `)
        .bind(targetId, org.organizationId)
        .get()) as any;

      await db
        .prepare(`
          UPDATE locations
          SET assigned_provider_id = ?, assigned_provider_name = ?, assigned_provider_email = ?, updated_at = ?
          WHERE id = ? AND organization_id = ?
        `)
        .bind(
          nextRemaining?.provider_id || null,
          nextRemaining?.name || null,
          nextRemaining?.email || null,
          now,
          targetId,
          org.organizationId
        )
        .run();

      return c.json({
        success: true,
        message: "Provider removed from location successfully.",
      });
    } catch (err: any) {
      console.error("removeProviderFromLocation error:", err);
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
      const org = await resolveAuthorizedOrg(c);
      if (!org) {
        return c.json({ success: false, message: "Unauthorized or invalid organization context" }, 403);
      }

      const locId = c.req.param("id");
      const db = getUniversalDb(c.env?.DB);
      await ensureSeatAssignmentsTable(db);

      // Resolve location by id or display_id and verify it belongs to user's authorized organization
      const loc = (await db
        .prepare(
          `SELECT l.id, l.display_id as displayId, l.name, l.short_code as shortCode, l.organization_id as organizationId, l.total_seats as totalSeats, o.short_code as orgShortCode 
           FROM locations l 
           LEFT JOIN organizations o ON l.organization_id = o.id 
           WHERE (l.id = ? OR l.display_id = ?) AND l.organization_id = ?`
        )
        .bind(locId, locId, org.organizationId)
        .get()) as any;

      if (!loc) {
        return c.json({ success: false, message: "Location not found in this organization" }, 404);
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
               s.id as displayId, 
               s.location_id as locationId, 
               s.organization_id as organizationId,
               s.number, 
               s.qr_token as qrToken,
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
                    number, qr_token as qrToken, employee, employee_name as employeeName, employee_email as employeeEmail, employee_id as employeeId,
                    order_url as orderUrl
             FROM seats WHERE location_id = ? OR location_id = ? ORDER BY CAST(number AS INTEGER) ASC`
          )
          .bind(targetLocId, locId)
          .all()) as any[];
      }

      // Ensure every seat has a permanent, unique QR token and permanent order URL
      for (const seat of (rows || [])) {
        if (!seat.qrToken) {
          const generatedToken = generateSeatQrToken();
          const targetUrl = `/${effectiveShortCode}/order/${generatedToken}`;
          seat.qrToken = generatedToken;
          seat.orderUrl = targetUrl;
          try {
            await db
              .prepare(`UPDATE seats SET qr_token = ?, order_url = ? WHERE location_id = ? AND id = ?`)
              .bind(generatedToken, targetUrl, targetLocId, seat.id)
              .run();
          } catch {}
        } else if (!seat.orderUrl || !seat.orderUrl.includes(seat.qrToken)) {
          seat.orderUrl = `/${effectiveShortCode}/order/${seat.qrToken}`;
          try {
            await db
              .prepare(`UPDATE seats SET order_url = ? WHERE location_id = ? AND id = ?`)
              .bind(seat.orderUrl, targetLocId, seat.id)
              .run();
          } catch {}
        }
      }

      // Compute next candidate sequence directly from id_sequences and this location's existing seats
      const locPrefix = normalizeLocationPrefix(loc.name);
      const orgCleanNum = parseInt(org.organizationId.replace(/\D/g, ""), 10);
      const orgPart = !isNaN(orgCleanNum)
        ? `ORG-${String(orgCleanNum).padStart(6, "0")}`
        : org.organizationId.toUpperCase();
      const locCleanNum = parseInt(String(targetLocId).replace(/\D/g, ""), 10);
      const locPart = !isNaN(locCleanNum)
        ? `LOC-${String(locCleanNum).padStart(6, "0")}`
        : `LOC-${String(targetLocId).toUpperCase()}`;
      const scopeKey = `SEAT_SEQ_${orgPart}_${locPart}`;

      let maxNum = 0;
      const usedNumbers = new Set<number>();
      for (const r of rows) {
        const n = parseInt(r.number, 10);
        if (!isNaN(n) && n > 0) {
          usedNumbers.add(n);
          maxNum = Math.max(maxNum, n);
        }
        const m = String(r.displayId || r.id || "").match(/(\d+)$/);
        if (m) {
          const idNum = parseInt(m[1], 10);
          if (!isNaN(idNum) && idNum > 0) {
            usedNumbers.add(idNum);
            maxNum = Math.max(maxNum, idNum);
          }
        }
      }

      let seqRow = (await db
        .prepare(`SELECT last_val FROM id_sequences WHERE scope = ?`)
        .bind(scopeKey)
        .get()) as any;
      let currentSeq = seqRow && typeof seqRow.last_val === "number" ? seqRow.last_val : maxNum;

      let nextCandidateNum = Math.max(currentSeq, maxNum) + 1;
      while (usedNumbers.has(nextCandidateNum)) {
        nextCandidateNum++;
      }
      const nextSeatPadded = String(nextCandidateNum).padStart(3, "0");
      const nextSeatId = `${locPrefix}-${nextSeatPadded}`;
      const nextSeatNumber = String(nextCandidateNum);

      // Compute occupancy metrics and return normalized seat objects
      const normalizedSeats = (rows || []).map((r) => {
        const assignedEmployee = r.employee || r.employeeEmail || r.employeeName || null;
        const isOccupied = Boolean(assignedEmployee);
        return {
          id: r.id,
          displayId: r.displayId || r.id,
          locationId: r.locationId || targetLocId,
          organizationId: r.organizationId || org.organizationId,
          number: r.number,
          qrToken: r.qrToken,
          employee: assignedEmployee,
          employeeName: r.employeeName || (assignedEmployee ? assignedEmployee.split("@")[0] : null),
          employeeEmail: r.employeeEmail || (r.employee && r.employee.includes("@") ? r.employee : null),
          employeeId: r.employeeId || null,
          employeeUserName: r.employeeUserName || null,
          employeeQrToken: r.employeeQrToken || null,
          assignmentId: r.assignmentId || null,
          assignedAt: r.assignedAt || null,
          orderUrl: r.orderUrl,
          isOccupied,
          status: isOccupied ? "Occupied" : "Available",
        };
      });

      const totalSeats = normalizedSeats.length;
      const occupiedSeats = normalizedSeats.filter((s) => s.isOccupied).length;
      const availableSeats = totalSeats - occupiedSeats;

      return c.json({
        success: true,
        seats: normalizedSeats,
        totalSeats,
        occupiedSeats,
        availableSeats,
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

      // Determine candidate sequence number and display identifier
      let parsedNum = 0;
      if (body.number || body.seatNo) {
        const raw = String(body.number || body.seatNo).trim();
        const p = parseInt(raw, 10);
        if (!isNaN(p) && p > 0) parsedNum = p;
      }

      let candidateDisplayId = (body.displayId || body.id || body.seatId) ? String(body.displayId || body.id || body.seatId).trim() : "";
      if (candidateDisplayId && !parsedNum) {
        const m = candidateDisplayId.match(/(\d+)$/);
        if (m) parsedNum = parseInt(m[1], 10);
      }

      // Generate globally unique Seat ID and friendly display identifier
      const generated = await generateLocationSeatId(
        db,
        org.organizationId,
        effectiveLocId,
        loc.name,
        parsedNum || undefined
      );

      const seatId = generated.seatId; // ORG-000001-LOC-000001-SEAT-001
      const number = generated.number;
      const displayId = generated.displayId; // OFFICE-001

      // Check for duplicate seat number or identifier within this organization and location
      const existingSeatRow = (await db
        .prepare(`SELECT id FROM seats WHERE organization_id = ? AND location_id = ? AND (id = ? OR number = ?)`)
        .bind(org.organizationId, effectiveLocId, seatId, number)
        .get()) as any;

      if (existingSeatRow) {
        return c.json({
          success: false,
          message: `This seat identifier already exists in this location.`
        }, 409);
      }

      const now = new Date().toISOString();
      const qrToken = generateSeatQrToken();
      const orderUrl = `${orgPrefix}/order/${qrToken}`;

      // Authoritative location-level employee email uniqueness check
      const candidateEmail = String(body.employeeEmail || body.employee || "").trim().toLowerCase();
      if (candidateEmail && candidateEmail.includes("@")) {
        const dupSeatInLoc = (await db
          .prepare(
            `SELECT id, display_id as displayId, number
             FROM seats
             WHERE organization_id = ? AND location_id = ?
               AND (
                 (employee_email IS NOT NULL AND LOWER(TRIM(employee_email)) = ?)
                 OR
                 (employee IS NOT NULL AND LOWER(TRIM(employee)) = ?)
               )`
          )
          .bind(org.organizationId, effectiveLocId, candidateEmail, candidateEmail)
          .get()) as any;

        if (dupSeatInLoc) {
          return c.json({
            success: false,
            message: "This employee email is already assigned to a seat in this location.",
          }, 409);
        }
      }

      // Employee assignment if requested
      const employeeIdentifier = body.employeeId || body.employeeEmail || body.employeeUserName || body.employee;
      let matchedUser: any = null;
      let assignmentId: string | null = null;
      const normalizedProvidedEmail = (body.employeeEmail || (body.employee && String(body.employee).includes("@") ? body.employee : "") || "").trim().toLowerCase() || null;
      const effectiveEmployeeName = (body.employeeName || (body.employee && !String(body.employee).includes("@") ? body.employee : "") || "").trim() || null;

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
              `SELECT esa.id, s.number, s.id as displayId, l.name as locName 
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
        }
      }

      // Determine final employee fields to persist
      const finalEmployeeEmail = matchedUser?.email ? matchedUser.email.toLowerCase() : normalizedProvidedEmail;
      const finalEmployeeName = matchedUser?.name || effectiveEmployeeName || (finalEmployeeEmail ? finalEmployeeEmail.split("@")[0] : null);
      const finalEmployeeField = finalEmployeeEmail || finalEmployeeName || null;
      const finalEmployeeId = matchedUser?.id || body.employeeId || null;

      // Insert seat record with unique qr_token and permanent seat order_url
      await db
        .prepare(
          `INSERT INTO seats (id, location_id, organization_id, number, employee, employee_name, employee_email, employee_id, qr_token, order_url, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          seatId,
          effectiveLocId,
          org.organizationId,
          number,
          finalEmployeeField,
          finalEmployeeName,
          finalEmployeeEmail,
          finalEmployeeId,
          qrToken,
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
          qrToken,
          employee: finalEmployeeField,
          employeeName: finalEmployeeName,
          employeeEmail: finalEmployeeEmail,
          employeeId: finalEmployeeId,
          employeeUserName: matchedUser ? matchedUser.userName : null,
          employeeQrToken: matchedUser ? matchedUser.qrToken : null,
          assignmentId,
          assignedAt: assignmentId ? now : null,
          orderUrl,
          isOccupied: Boolean(finalEmployeeEmail || finalEmployeeName || matchedUser),
          status: Boolean(finalEmployeeEmail || finalEmployeeName || matchedUser) ? "Occupied" : "Available",
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
      const rawNumber = numberMatch ? String(parseInt(numberMatch[1], 10)) : seatParam;
      const extractedNumber2 = numberMatch ? numberMatch[1].padStart(2, "0") : seatParam;
      const extractedNumber3 = numberMatch ? numberMatch[1].padStart(3, "0") : seatParam;

      // Verify seat exists in D1
      let seat = (await db
        .prepare(
          `SELECT id, display_id as displayId, number, location_id as locationId, qr_token as qrToken, order_url as orderUrl 
           FROM seats 
           WHERE (location_id = ? OR location_id = ? OR CAST(location_id AS TEXT) = ? OR CAST(location_id AS TEXT) = ?)
             AND organization_id = ?
             AND (
               id = ? OR 
               display_id = ? OR 
               number = ? OR 
               number = ? OR 
               number = ? OR
               LOWER(id) = LOWER(?) OR
               LOWER(display_id) = LOWER(?)
             )`
        )
        .bind(
          effectiveLocId,
          locId,
          String(effectiveLocId),
          String(locId),
          org.organizationId,
          seatParam,
          seatParam,
          rawNumber,
          extractedNumber2,
          extractedNumber3,
          seatParam,
          seatParam
        )
        .get()) as any;

      if (!seat) {
        return c.json({ success: false, message: "Seat not found in this location" }, 404);
      }

      const orgPrefix = org.shortCode ? `/${org.shortCode}` : "";
      if (!seat.qrToken) {
        seat.qrToken = generateSeatQrToken();
        seat.orderUrl = `${orgPrefix}/order/${seat.qrToken}`;
        await db
          .prepare(`UPDATE seats SET qr_token = ?, order_url = ? WHERE location_id = ? AND id = ?`)
          .bind(seat.qrToken, seat.orderUrl, effectiveLocId, seat.id)
          .run();
      } else if (!seat.orderUrl || !seat.orderUrl.includes(seat.qrToken)) {
        seat.orderUrl = `${orgPrefix}/order/${seat.qrToken}`;
        await db
          .prepare(`UPDATE seats SET order_url = ? WHERE location_id = ? AND id = ?`)
          .bind(seat.orderUrl, effectiveLocId, seat.id)
          .run();
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

      // Extract explicit fallback employee fields if not a registered system user
      const fallbackEmail = (body.employeeEmail || (cleanIdent.includes("@") ? cleanIdent : null) || "").trim().toLowerCase() || null;
      const fallbackName = (body.employeeName || (!cleanIdent.includes("@") ? cleanIdent : null) || (fallbackEmail ? fallbackEmail.split("@")[0] : null) || "").trim() || null;

      if (!user && !fallbackEmail && !fallbackName) {
        return c.json({ success: false, message: "Employee not found in this organization" }, 404);
      }

      // Check location-level employee email uniqueness
      const candidateUserEmail = user?.email ? String(user.email).trim().toLowerCase() : fallbackEmail;
      if (candidateUserEmail) {
        const dupSeatInLoc = (await db
          .prepare(
            `SELECT id, display_id as displayId, number
             FROM seats
             WHERE organization_id = ? AND location_id = ? AND id != ?
               AND (
                 (employee_email IS NOT NULL AND LOWER(TRIM(employee_email)) = ?)
                 OR
                 (employee IS NOT NULL AND LOWER(TRIM(employee)) = ?)
               )`
          )
          .bind(org.organizationId, effectiveLocId, seat.id, candidateUserEmail, candidateUserEmail)
          .get()) as any;

        if (dupSeatInLoc) {
          return c.json({
            success: false,
            message: "This employee email is already assigned to a seat in this location.",
          }, 409);
        }
      }

      // Prevent duplicate assignment: Check if registered employee already has an active assignment on ANOTHER seat
      if (user) {
        const duplicateAssignment = (await db
          .prepare(
            `SELECT esa.id, esa.seat_id, s.number, s.id as displayId, l.name as locName 
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
      }

      const now = new Date().toISOString();
      const orderUrl = seat.orderUrl;

      // Upsert into employee_seat_assignments if user exists, or delete if no longer assigned to a user
      let assignmentId = existingSeatAssignment?.id;
      if (user) {
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
      } else if (existingSeatAssignment) {
        // If updating to a custom name/email not tied to a users table record, delete old foreign key assignment
        await db
          .prepare(`DELETE FROM employee_seat_assignments WHERE seat_id = ?`)
          .bind(seat.id)
          .run();
        assignmentId = null;
      }

      const finalAssignedEmail = user ? user.email.toLowerCase() : candidateUserEmail;
      const finalAssignedName = user ? user.name : (fallbackName || "Employee");
      const finalAssignedId = user ? user.id : (body.employeeId || null);

      // Update seats table (preserving permanent seat order_url and qr_token)
      await db
        .prepare(
          `UPDATE seats 
           SET employee = ?, 
               employee_name = ?, 
               employee_email = ?, 
               employee_id = ?, 
               updated_at = ? 
           WHERE location_id = ? AND id = ?`
        )
        .bind(finalAssignedEmail || finalAssignedName, finalAssignedName, finalAssignedEmail, finalAssignedId, now, effectiveLocId, seat.id)
        .run();

      return c.json({
        success: true,
        message: `Seat ${seat.number} successfully assigned to ${finalAssignedName}.`,
        seat: {
          id: seat.id,
          displayId: seat.displayId,
          number: seat.number,
          qrToken: seat.qrToken,
          locationId: effectiveLocId,
          organizationId: org.organizationId,
          employee: finalAssignedEmail || finalAssignedName,
          employeeName: finalAssignedName,
          employeeEmail: finalAssignedEmail,
          employeeId: finalAssignedId,
          employeeUserName: user ? user.userName : null,
          employeeQrToken: user ? user.qrToken : null,
          assignmentId,
          assignedAt: now,
          orderUrl,
          isOccupied: true,
          status: "Occupied",
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
      const rawNumber = numberMatch ? String(parseInt(numberMatch[1], 10)) : seatParam;
      const extractedNumber2 = numberMatch ? numberMatch[1].padStart(2, "0") : seatParam;
      const extractedNumber3 = numberMatch ? numberMatch[1].padStart(3, "0") : seatParam;

      // Find the seat
      let seat = (await db
        .prepare(
          `SELECT id, display_id as displayId, number, location_id as locationId, qr_token as qrToken, order_url as orderUrl 
           FROM seats 
           WHERE (location_id = ? OR location_id = ? OR CAST(location_id AS TEXT) = ? OR CAST(location_id AS TEXT) = ?)
             AND organization_id = ?
             AND (
               id = ? OR 
               display_id = ? OR 
               number = ? OR 
               number = ? OR 
               number = ? OR
               LOWER(id) = LOWER(?) OR
               LOWER(display_id) = LOWER(?)
             )`
        )
        .bind(
          effectiveLocId,
          locId,
          String(effectiveLocId),
          String(locId),
          org.organizationId,
          seatParam,
          seatParam,
          rawNumber,
          extractedNumber2,
          extractedNumber3,
          seatParam,
          seatParam
        )
        .get()) as any;

      if (!seat) {
        return c.json({ success: false, message: "Seat not found in this location" }, 404);
      }

      const now = new Date().toISOString();
      const orgPrefix = org.shortCode ? `/${org.shortCode}` : "";
      if (!seat.qrToken) {
        seat.qrToken = generateSeatQrToken();
        seat.orderUrl = `${orgPrefix}/order/${seat.qrToken}`;
        await db
          .prepare(`UPDATE seats SET qr_token = ?, order_url = ? WHERE location_id = ? AND id = ?`)
          .bind(seat.qrToken, seat.orderUrl, effectiveLocId, seat.id)
          .run();
      } else if (!seat.orderUrl || !seat.orderUrl.includes(seat.qrToken)) {
        seat.orderUrl = `${orgPrefix}/order/${seat.qrToken}`;
        await db
          .prepare(`UPDATE seats SET order_url = ? WHERE location_id = ? AND id = ?`)
          .bind(seat.orderUrl, effectiveLocId, seat.id)
          .run();
      }
      const orderUrl = seat.orderUrl;

      // Delete only the assignment record from employee_seat_assignments
      await db
        .prepare(`DELETE FROM employee_seat_assignments WHERE seat_id = ?`)
        .bind(seat.id)
        .run();

      // Clear employee information on seats table (keeping permanent qr_token and order_url intact)
      await db
        .prepare(
          `UPDATE seats 
           SET employee = NULL, 
               employee_name = NULL, 
               employee_email = NULL, 
               employee_id = NULL, 
               updated_at = ? 
           WHERE location_id = ? AND id = ?`
        )
        .bind(now, effectiveLocId, seat.id)
        .run();

      return c.json({
        success: true,
        message: "Employee assignment removed successfully. Seat remains available.",
        seat: {
          id: seat.id,
          displayId: seat.displayId,
          number: seat.number,
          qrToken: seat.qrToken,
          locationId: effectiveLocId,
          employee: null,
          employeeName: null,
          employeeEmail: null,
          employeeId: null,
          employeeUserName: null,
          employeeQrToken: null,
          assignmentId: null,
          assignedAt: null,
          orderUrl,
          isOccupied: false,
          status: "Available",
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
      const rawNumber = numberMatch ? String(parseInt(numberMatch[1], 10)) : seatParam;
      const extractedNumber2 = numberMatch ? numberMatch[1].padStart(2, "0") : seatParam;
      const extractedNumber3 = numberMatch ? numberMatch[1].padStart(3, "0") : seatParam;

      const seat = (await db
        .prepare(
          `SELECT id, display_id as displayId, number, employee, employee_id as employeeId 
           FROM seats 
           WHERE (location_id = ? OR location_id = ? OR CAST(location_id AS TEXT) = ? OR CAST(location_id AS TEXT) = ?)
             AND organization_id = ?
             AND (
               id = ? OR 
               display_id = ? OR 
               number = ? OR 
               number = ? OR 
               number = ? OR
               LOWER(id) = LOWER(?) OR
               LOWER(display_id) = LOWER(?)
             )`
        )
        .bind(
          effectiveLocId,
          locId,
          String(effectiveLocId),
          String(locId),
          org.organizationId,
          seatParam,
          seatParam,
          rawNumber,
          extractedNumber2,
          extractedNumber3,
          seatParam,
          seatParam
        )
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
        try {
          await db
            .prepare(`DELETE FROM user_sessions WHERE user_id = ?`)
            .bind(targetUserId)
            .run();
        } catch {}

        // 6. Delete provider locations
        try {
          await db
            .prepare(`DELETE FROM provider_locations WHERE provider_id = ?`)
            .bind(targetUserId)
            .run();
        } catch {}

        // 7. Delete user organization memberships
        await db
          .prepare(`DELETE FROM user_organizations WHERE user_id = ?`)
          .bind(targetUserId)
          .run();

        // 8. Permanently delete the user from users table
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
          LOWER(s.id) LIKE ?
        )`;
        const searchPattern = `%${search}%`;
        params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
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
               s.id as seatDisplayId,
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
