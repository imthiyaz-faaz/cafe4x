import { Context } from "hono";
import { getDb } from "../db";

export interface ItemModel {
  id: string;
  organizationId?: string;
  shortCode?: string;
  name: string;
  description?: string;
  image?: string;
  status: "Active" | "Out of Stock";
  preference?: string;
  amount: number;
  type: "Beverages" | "Snacks";
  category: string;
  isLiked?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export let itemsStore: ItemModel[] = [];

function syncItemsFromDb() {
  try {
    const db = getDb();
    const rows = db.prepare(`
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
    `).all() as any[];

    if (rows && rows.length > 0) {
      itemsStore = rows.map((r) => ({
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
}

// Initial sync on startup
syncItemsFromDb();

export const itemsController = {
  // GET /api/items?shortCode=xxx&organizationId=yyy&type=zzz
  async getItems(c: Context) {
    try {
      syncItemsFromDb();
      const shortCode = c.req.query("shortCode");
      const organizationId = c.req.query("organizationId");
      const type = c.req.query("type");

      let result = [...itemsStore];

      if (shortCode) {
        result = result.filter(
          (item) => (item.shortCode || "").toUpperCase() === shortCode.toUpperCase()
        );
      } else if (organizationId) {
        result = result.filter((item) => item.organizationId === organizationId);
      }

      if (type && type !== "All") {
        result = result.filter((item) => item.type.toLowerCase() === type.toLowerCase());
      }

      return c.json({
        success: true,
        items: result,
      });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // GET /api/items/:id
  async getItemById(c: Context) {
    try {
      syncItemsFromDb();
      const id = c.req.param("id");
      const found = itemsStore.find((i) => i.id === id);
      if (!found) {
        return c.json({ success: false, message: "Item not found" }, 404);
      }
      return c.json({ success: true, item: found });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // POST /api/items
  async createItem(c: Context) {
    try {
      const body = await c.req.json();
      if (!body.name || !body.name.trim()) {
        return c.json({ success: false, message: "Item name is required" }, 400);
      }

      const id = body.id ? String(body.id) : Date.now().toString();
      const name = body.name.trim();
      const description = body.description ? body.description.trim() : "";
      const image = body.image || "";
      const status = body.status || "Active";
      const preference = body.preference || body.preferences || "";
      const amount = Number(body.amount) || 0;
      const type = body.type || "Beverages";
      const category = body.category || (type === "Snacks" ? "Food" : "Drinks");
      const organizationId = body.organizationId || "";
      const shortCode = (body.shortCode || "").toUpperCase();
      const now = new Date().toISOString();

      try {
        const db = getDb();
        db.prepare(`
          INSERT INTO items (
            id, organization_id, short_code, name, description, image,
            status, preference, amount, type, category, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          organizationId || null,
          shortCode || null,
          name,
          description || null,
          image || null,
          status,
          preference || null,
          amount,
          type,
          category,
          now,
          now
        );
      } catch (dbErr) {
        console.warn("Could not insert item into SQLite:", dbErr);
      }

      const newItem: ItemModel = {
        id,
        name,
        description,
        image,
        status: status as "Active" | "Out of Stock",
        preference,
        amount,
        type: type as "Beverages" | "Snacks",
        category,
        organizationId,
        shortCode,
        createdAt: now,
        updatedAt: now,
      };

      itemsStore.unshift(newItem);
      return c.json({ success: true, item: newItem }, 201);
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // PUT /api/items/:id
  async updateItem(c: Context) {
    try {
      const id = c.req.param("id");
      const body = await c.req.json();
      const now = new Date().toISOString();

      const name = body.name ? body.name.trim() : null;
      const description = body.description !== undefined ? body.description.trim() : null;
      const image = body.image !== undefined ? body.image : null;
      const status = body.status !== undefined ? body.status : null;
      const preference = body.preference !== undefined ? body.preference : (body.preferences !== undefined ? body.preferences : null);
      const amount = body.amount !== undefined ? Number(body.amount) : null;
      const type = body.type !== undefined ? body.type : null;
      const category = body.category !== undefined ? body.category : (type ? (type === "Snacks" ? "Food" : "Drinks") : null);

      try {
        const db = getDb();
        db.prepare(`
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
        `).run(
          name,
          description,
          image,
          status,
          preference,
          amount,
          type,
          category,
          now,
          id
        );
      } catch (dbErr) {
        console.warn("Could not update item in SQLite:", dbErr);
      }

      syncItemsFromDb();
      const found = itemsStore.find((i) => i.id === id);
      return c.json({ success: true, item: found || { id, ...body } });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // DELETE /api/items/:id
  async deleteItem(c: Context) {
    try {
      const id = c.req.param("id");
      try {
        const db = getDb();
        db.prepare(`DELETE FROM items WHERE id = ?`).run(id);
      } catch (dbErr) {
        console.warn("Could not delete item from SQLite:", dbErr);
      }

      itemsStore = itemsStore.filter((i) => i.id !== id);
      return c.json({ success: true, message: "Item deleted successfully" });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // POST /api/items/:id/like
  async toggleLike(c: Context) {
    const id = c.req.param("id");
    return c.json({ success: true, id, isLiked: true });
  },
};
