import { Context } from "hono";
import { getUniversalDb } from "../db";
import { AppEnv } from "../types";
import { resolveAuthorizedOrg } from "../middleware/auth.middleware";
import { getNextId } from "../utils/id-generator";

export interface ItemModel {
  id: string;
  displayId?: string;
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

export const itemsController = {
  // GET /api/items
  async getItems(c: Context<AppEnv>) {
    try {
      const org = await resolveAuthorizedOrg(c, { allowPublic: true });
      if (!org) {
        return c.json({ success: false, message: "Organization not found or access denied" }, 403);
      }

      const db = getUniversalDb(c.env?.DB);
      const type = c.req.query("type");

      let query = `
        SELECT 
          i.id,
          i.display_id as displayId,
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
        WHERE i.organization_id = ?
      `;
      const params: any[] = [org.organizationId];

      if (type && type !== "All") {
        query += ` AND LOWER(i.type) = LOWER(?)`;
        params.push(type);
      }

      query += ` ORDER BY i.created_at DESC`;

      const rows = (await db.prepare(query).bind(...params).all()) as any[];

      const items: ItemModel[] = (rows || []).map((r) => ({
        id: String(r.id),
        displayId: r.displayId || `ITEM-${r.shortCode || org.shortCode}-${r.id}`,
        organizationId: r.organizationId || org.organizationId,
        shortCode: r.shortCode || org.shortCode,
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

      return c.json({
        success: true,
        items,
      });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // GET /api/items/:id
  async getItemById(c: Context<AppEnv>) {
    try {
      const id = c.req.param("id");
      const db = getUniversalDb(c.env?.DB);

      const row = (await db
        .prepare(
          `SELECT 
            id, display_id as displayId, organization_id as organizationId, short_code as shortCode,
            name, description, image, status, preference, amount, type, category,
            created_at as createdAt, updated_at as updatedAt
           FROM items WHERE id = ? OR display_id = ?`
        )
        .bind(id, id)
        .get()) as any;

      if (!row) {
        return c.json({ success: false, message: "Item not found" }, 404);
      }

      return c.json({
        success: true,
        item: {
          id: String(row.id),
          displayId: row.displayId,
          organizationId: row.organizationId,
          shortCode: row.shortCode,
          name: row.name,
          description: row.description || "",
          image: row.image || "",
          status: row.status,
          preference: row.preference || "",
          amount: Number(row.amount) || 0,
          type: row.type,
          category: row.category,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        },
      });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // POST /api/items
  async createItem(c: Context<AppEnv>) {
    try {
      const org = await resolveAuthorizedOrg(c);
      if (!org) {
        return c.json({ success: false, message: "Unauthorized or invalid organization context" }, 403);
      }

      const body = await c.req.json();
      if (!body.name || !body.name.trim()) {
        return c.json({ success: false, message: "Item name is required" }, 400);
      }

      const db = getUniversalDb(c.env?.DB);
      const { displayId } = await getNextId(db, "ITEM", org.shortCode);

      const id = body.id ? String(body.id) : displayId;
      const name = body.name.trim();
      const description = body.description ? body.description.trim() : "";
      const image = body.image || "";
      const status = body.status || "Active";
      const preference = body.preference || body.preferences || "";
      const amount = Number(body.amount) || 0;
      const type = body.type || "Beverages";
      const category = body.category || (type === "Snacks" ? "Food" : "Drinks");
      const now = new Date().toISOString();

      await db
        .prepare(
          `INSERT INTO items (
            id, display_id, organization_id, short_code, name, description, image,
            status, preference, amount, type, category, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          id,
          displayId,
          org.organizationId,
          org.shortCode,
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

      const newItem: ItemModel = {
        id,
        displayId,
        name,
        description,
        image,
        status: status as "Active" | "Out of Stock",
        preference,
        amount,
        type: type as "Beverages" | "Snacks",
        category,
        organizationId: org.organizationId,
        shortCode: org.shortCode,
        createdAt: now,
        updatedAt: now,
      };

      return c.json({ success: true, item: newItem }, 201);
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // PUT /api/items/:id
  async updateItem(c: Context<AppEnv>) {
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
        .prepare(`SELECT id FROM items WHERE (id = ? OR display_id = ?) AND organization_id = ?`)
        .bind(id, id, org.organizationId)
        .get()) as any;

      if (!existing) {
        return c.json({ success: false, message: "Item not found in this organization" }, 404);
      }

      const targetId = existing.id;
      const name = body.name ? body.name.trim() : null;
      const description = body.description !== undefined ? body.description.trim() : null;
      const image = body.image !== undefined ? body.image : null;
      const status = body.status !== undefined ? body.status : null;
      const preference = body.preference !== undefined ? body.preference : (body.preferences !== undefined ? body.preferences : null);
      const amount = body.amount !== undefined ? Number(body.amount) : null;
      const type = body.type !== undefined ? body.type : null;
      const category = body.category !== undefined ? body.category : (type ? (type === "Snacks" ? "Food" : "Drinks") : null);

      await db
        .prepare(
          `UPDATE items
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
           WHERE id = ? AND organization_id = ?`
        )
        .run(
          name,
          description,
          image,
          status,
          preference,
          amount,
          type,
          category,
          now,
          targetId,
          org.organizationId
        );

      const updated = (await db.prepare(`SELECT * FROM items WHERE id = ?`).bind(targetId).get()) as any;
      return c.json({ success: true, item: updated });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // DELETE /api/items/:id
  async deleteItem(c: Context<AppEnv>) {
    try {
      const org = await resolveAuthorizedOrg(c);
      if (!org) {
        return c.json({ success: false, message: "Unauthorized or invalid organization context" }, 403);
      }

      const id = c.req.param("id");
      const db = getUniversalDb(c.env?.DB);

      const res = await db
        .prepare(`DELETE FROM items WHERE (id = ? OR display_id = ?) AND organization_id = ?`)
        .bind(id, id, org.organizationId)
        .run();

      if (res.changes === 0) {
        return c.json({ success: false, message: "Item not found in this organization" }, 404);
      }

      return c.json({ success: true, message: "Item deleted successfully" });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // POST /api/items/:id/like
  async toggleLike(c: Context<AppEnv>) {
    const id = c.req.param("id");
    return c.json({ success: true, id, isLiked: true });
  },
};
