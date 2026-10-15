import { Context } from "hono";
import { getDb } from "../db";

export interface LocationModel {
  id: string;
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

let locationsStore: LocationModel[] = [];

function syncLocationsFromDb() {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT 
        l.id,
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
      ORDER BY l.created_at DESC
    `).all() as any[];

    if (rows && rows.length > 0) {
      locationsStore = rows.map((r) => ({
        id: String(r.id),
        organizationId: r.organizationId || "",
        shortCode: r.shortCode || "",
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
    } else {
      locationsStore = [];
    }
  } catch (err) {
    console.warn("Could not sync locations from SQLite:", err);
  }
}

// Initial sync on startup
syncLocationsFromDb();

export const locationController = {
  // GET /api/locations?shortCode=xxx&providerId=yyy&organizationId=zzz
  async getLocations(c: Context) {
    try {
      syncLocationsFromDb();
      const providerId = c.req.query("providerId");
      const shortCode = c.req.query("shortCode");
      const organizationId = c.req.query("organizationId");

      let result = [...locationsStore];

      if (shortCode) {
        result = result.filter(
          (loc) => (loc.shortCode || "").toUpperCase() === shortCode.toUpperCase()
        );
      } else if (organizationId) {
        result = result.filter((loc) => loc.organizationId === organizationId);
      }

      if (providerId) {
        result = result.filter((loc) => loc.assignedProviderId === providerId);
      }

      return c.json({
        success: true,
        locations: result,
      });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // GET /api/locations/:id
  async getLocationById(c: Context) {
    try {
      syncLocationsFromDb();
      const id = c.req.param("id");
      const found = locationsStore.find((l) => l.id === id);
      if (!found) {
        return c.json({ success: false, message: "Location not found" }, 404);
      }
      return c.json({ success: true, location: found });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // POST /api/locations
  async createLocation(c: Context) {
    try {
      const body = await c.req.json();
      if (!body.name || !body.name.trim()) {
        return c.json({ success: false, message: "Location name is required" }, 400);
      }

      const id = body.id ? String(body.id) : Date.now().toString();
      const name = body.name.trim();
      const status = body.status || "Active";
      const totalSeats = Number(body.totalSeats) || 12;
      const image = body.image || "";
      const organizationId = body.organizationId || "";
      const shortCode = (body.shortCode || "").toUpperCase();
      const assignedProviderId = body.assignedProviderId || null;
      const assignedProviderName = body.assignedProviderName || null;
      const assignedProviderEmail = body.assignedProviderEmail || null;
      const now = new Date().toISOString();

      try {
        const db = getDb();
        db.prepare(`
          INSERT INTO locations (
            id, organization_id, short_code, name, status, total_seats, image,
            assigned_provider_id, assigned_provider_name, assigned_provider_email,
            created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          organizationId || null,
          shortCode || null,
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
      } catch (dbErr) {
        console.warn("Could not insert location into SQLite:", dbErr);
      }

      const newLoc: LocationModel = {
        id,
        name,
        status,
        totalSeats,
        image,
        organizationId,
        shortCode,
        assignedProviderId: assignedProviderId || undefined,
        assignedProviderName: assignedProviderName || undefined,
        assignedProviderEmail: assignedProviderEmail || undefined,
        createdAt: now,
        updatedAt: now,
      };

      locationsStore.unshift(newLoc);
      return c.json({ success: true, location: newLoc }, 201);
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // PUT /api/locations/:id
  async updateLocation(c: Context) {
    try {
      const id = c.req.param("id");
      const body = await c.req.json();
      const now = new Date().toISOString();

      try {
        const db = getDb();
        db.prepare(`
          UPDATE locations
          SET 
            name = COALESCE(?, name),
            status = COALESCE(?, status),
            total_seats = COALESCE(?, total_seats),
            image = COALESCE(?, image),
            assigned_provider_id = ?,
            assigned_provider_name = ?,
            assigned_provider_email = ?,
            updated_at = ?
          WHERE id = ?
        `).run(
          body.name ? body.name.trim() : null,
          body.status || null,
          body.totalSeats ? Number(body.totalSeats) : null,
          body.image || null,
          body.assignedProviderId || null,
          body.assignedProviderName || null,
          body.assignedProviderEmail || null,
          now,
          id
        );
      } catch (dbErr) {
        console.warn("Could not update location in SQLite:", dbErr);
      }

      syncLocationsFromDb();
      const found = locationsStore.find((l) => l.id === id);
      return c.json({ success: true, location: found || body });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // POST /api/locations/:id/assign
  async assignProvider(c: Context) {
    try {
      const id = c.req.param("id");
      const body = await c.req.json();
      const now = new Date().toISOString();

      try {
        const db = getDb();
        db.prepare(`
          UPDATE locations
          SET 
            assigned_provider_id = ?,
            assigned_provider_name = ?,
            assigned_provider_email = ?,
            updated_at = ?
          WHERE id = ?
        `).run(
          body.assignedProviderId || null,
          body.assignedProviderName || null,
          body.assignedProviderEmail || null,
          now,
          id
        );
      } catch (dbErr) {
        console.warn("Could not assign provider in SQLite:", dbErr);
      }

      syncLocationsFromDb();
      const found = locationsStore.find((l) => l.id === id);
      return c.json({ success: true, location: found || { id, ...body } });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // DELETE /api/locations/:id
  async deleteLocation(c: Context) {
    try {
      const id = c.req.param("id");
      try {
        const db = getDb();
        db.prepare(`DELETE FROM locations WHERE id = ?`).run(id);
      } catch (dbErr) {
        console.warn("Could not delete location from SQLite:", dbErr);
      }

      locationsStore = locationsStore.filter((l) => l.id !== id);
      return c.json({ success: true, message: "Location deleted successfully" });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },
};

