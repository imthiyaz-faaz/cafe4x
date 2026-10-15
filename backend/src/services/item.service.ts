import { getDb } from "../db";
import { ItemModel } from "../controllers/items.controller";

export const itemBackendService = {
  syncItemsFromDb(): ItemModel[] {
    try {
      const db = getDb();
      const rows = db
        .prepare(
          `
        SELECT 
          i.id,
          i.organization_id as organizationId,
          i.short_code as shortCode,
          i.name,
          i.description,
          i.image,
          i.status,
          i.preference,
          i.amount,
          i.type,
          i.category,
          i.created_at as createdAt,
          i.updated_at as updatedAt
        FROM items i
        ORDER BY i.created_at DESC
      `
        )
        .all() as any[];

      if (rows && rows.length > 0) {
        return rows.map((r) => ({
          id: String(r.id),
          organizationId: r.organizationId || "",
          shortCode: r.shortCode || "",
          name: r.name,
          description: r.description || "",
          image: r.image || "",
          status: (r.status || "Active") as "Active" | "Out of Stock",
          preference: r.preference || "",
          amount: Number(r.amount) || 0,
          type: (r.type || "Beverages") as "Beverages" | "Snacks",
          category: r.category || (r.type === "Snacks" ? "Food" : "Drinks"),
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        }));
      }
    } catch (err) {
      console.warn("Could not sync items from SQLite:", err);
    }
    return [];
  },

  createItem(item: ItemModel): void {
    try {
      const db = getDb();
      db.prepare(
        `
        INSERT INTO items (
          id, organization_id, short_code, name, description, image,
          status, preference, amount, type, category, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      ).run(
        item.id,
        item.organizationId || null,
        item.shortCode || null,
        item.name,
        item.description || null,
        item.image || null,
        item.status,
        item.preference || null,
        item.amount,
        item.type,
        item.category,
        item.createdAt,
        item.updatedAt
      );
    } catch (dbErr) {
      console.warn("Could not insert item into SQLite:", dbErr);
    }
  },

  updateItem(id: string, updates: Partial<ItemModel>): void {
    try {
      const db = getDb();
      db.prepare(
        `
        UPDATE items
        SET 
          name = COALESCE(?, name),
          description = COALESCE(?, description),
          image = COALESCE(?, image),
          status = COALESCE(?, status),
          preference = COALESCE(?, preference),
          amount = COALESCE(?, amount),
          type = COALESCE(?, type),
          category = COALESCE(?, category),
          updated_at = ?
        WHERE id = ?
      `
      ).run(
        updates.name || null,
        updates.description || null,
        updates.image || null,
        updates.status || null,
        updates.preference || null,
        updates.amount !== undefined ? Number(updates.amount) : null,
        updates.type || null,
        updates.category || null,
        new Date().toISOString(),
        id
      );
    } catch (dbErr) {
      console.warn("Could not update item in SQLite:", dbErr);
    }
  },

  deleteItem(id: string): void {
    try {
      const db = getDb();
      db.prepare(`DELETE FROM items WHERE id = ?`).run(id);
    } catch (dbErr) {
      console.warn("Could not delete item from SQLite:", dbErr);
    }
  },
};

export default itemBackendService;
