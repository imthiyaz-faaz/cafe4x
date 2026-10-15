import { getDb } from "../db";
import { LocationModel } from "../controllers/location.controller";

export const locationBackendService = {
  syncLocationsFromDb(): LocationModel[] {
    try {
      const db = getDb();
      const rows = db
        .prepare(
          `
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
      `
        )
        .all() as any[];

      if (rows && rows.length > 0) {
        return rows.map((r) => ({
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
      }
    } catch (err) {
      console.warn("Could not sync locations from SQLite:", err);
    }
    return [];
  },

  createLocation(loc: LocationModel): void {
    try {
      const db = getDb();
      db.prepare(
        `
        INSERT INTO locations (
          id, organization_id, short_code, name, status, total_seats, image,
          assigned_provider_id, assigned_provider_name, assigned_provider_email,
          created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      ).run(
        loc.id,
        loc.organizationId || null,
        loc.shortCode || null,
        loc.name,
        loc.status,
        loc.totalSeats,
        loc.image || null,
        loc.assignedProviderId || null,
        loc.assignedProviderName || null,
        loc.assignedProviderEmail || null,
        loc.createdAt,
        loc.updatedAt
      );
    } catch (dbErr) {
      console.warn("Could not insert location into SQLite:", dbErr);
    }
  },

  updateLocation(id: string, updates: Partial<LocationModel>): void {
    try {
      const db = getDb();
      db.prepare(
        `
        UPDATE locations
        SET 
          name = COALESCE(?, name),
          status = COALESCE(?, status),
          total_seats = COALESCE(?, total_seats),
          image = COALESCE(?, image),
          assigned_provider_id = COALESCE(?, assigned_provider_id),
          assigned_provider_name = COALESCE(?, assigned_provider_name),
          assigned_provider_email = COALESCE(?, assigned_provider_email),
          updated_at = ?
        WHERE id = ?
      `
      ).run(
        updates.name || null,
        updates.status || null,
        updates.totalSeats ? Number(updates.totalSeats) : null,
        updates.image || null,
        updates.assignedProviderId || null,
        updates.assignedProviderName || null,
        updates.assignedProviderEmail || null,
        new Date().toISOString(),
        id
      );
    } catch (dbErr) {
      console.warn("Could not update location in SQLite:", dbErr);
    }
  },

  assignProvider(
    id: string,
    provider: {
      assignedProviderId?: string;
      assignedProviderName?: string;
      assignedProviderEmail?: string;
    }
  ): void {
    try {
      const db = getDb();
      db.prepare(
        `
        UPDATE locations
        SET 
          assigned_provider_id = ?,
          assigned_provider_name = ?,
          assigned_provider_email = ?,
          updated_at = ?
        WHERE id = ?
      `
      ).run(
        provider.assignedProviderId || null,
        provider.assignedProviderName || null,
        provider.assignedProviderEmail || null,
        new Date().toISOString(),
        id
      );
    } catch (dbErr) {
      console.warn("Could not assign provider in SQLite:", dbErr);
    }
  },

  deleteLocation(id: string): void {
    try {
      const db = getDb();
      db.prepare(`DELETE FROM locations WHERE id = ?`).run(id);
    } catch (dbErr) {
      console.warn("Could not delete location from SQLite:", dbErr);
    }
  },
};

export default locationBackendService;
