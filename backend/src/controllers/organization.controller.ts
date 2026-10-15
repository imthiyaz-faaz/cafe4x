import { Context } from "hono";
import { getDb } from "../db";

export interface OrganizationModel {
  id: string;
  name: string;
  shortCode: string;
  ownerUserId?: string;
  createdAt: string;
}

export let organizationsStore: OrganizationModel[] = [];

export const organizationController = {
  // GET /api/organizations?userId=xxx
  async getOrganizations(c: Context) {
    try {
      const userId = c.req.query("userId");
      const db = getDb();

      if (userId) {
        try {
          const rows = db.prepare(`
            SELECT o.id, o.name, o.short_code as shortCode, o.owner_user_id as ownerUserId, o.created_at as createdAt
            FROM organizations o
            JOIN user_organizations uo ON o.id = uo.organization_id
            WHERE uo.user_id = ?
            ORDER BY o.created_at DESC
          `).all(userId) as any[];

          if (rows && rows.length > 0) {
            return c.json({ success: true, organizations: rows });
          }
        } catch (e) {
          console.warn("DB query failed, using store:", e);
        }
      } else {
        try {
          const rows = db.prepare(`
            SELECT id, name, short_code as shortCode, owner_user_id as ownerUserId, created_at as createdAt
            FROM organizations
            ORDER BY created_at DESC
          `).all() as any[];

          if (rows && rows.length > 0) {
            return c.json({ success: true, organizations: rows });
          }
        } catch (e) {
          console.warn("DB query failed, using store:", e);
        }
      }

      return c.json({ success: true, organizations: organizationsStore });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // POST /api/organizations
  async createOrganization(c: Context) {
    try {
      const body = await c.req.json();
      const name = (body.name || "").trim();
      const shortCode = (body.shortCode || "").trim().toUpperCase();
      const userId = body.userId ? String(body.userId) : "";

      if (!name || !shortCode) {
        return c.json({ success: false, message: "Organization name and shortCode are required" }, 400);
      }

      const orgId = `org_${shortCode.toLowerCase()}_${Date.now()}`;
      const now = new Date().toISOString();

      try {
        const db = getDb();
        // Insert organization
        db.prepare(`
          INSERT INTO organizations (id, name, short_code, owner_user_id, created_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(orgId, name, shortCode, userId || null, now);

        // If userId provided, link in user_organizations
        if (userId) {
          db.prepare(`
            INSERT OR IGNORE INTO user_organizations (id, user_id, organization_id, role, created_at)
            VALUES (?, ?, ?, 'Owner', ?)
          `).run(`uo_${Date.now()}`, userId, orgId, now);
        }
      } catch (dbErr: any) {
        if (dbErr.message && dbErr.message.includes("UNIQUE")) {
          return c.json({ success: false, message: "Organization with this shortCode already exists" }, 409);
        }
        console.warn("DB insert error:", dbErr);
      }

      const newOrg: OrganizationModel = {
        id: orgId,
        name,
        shortCode,
        ownerUserId: userId,
        createdAt: now,
      };

      organizationsStore.unshift(newOrg);

      return c.json({
        success: true,
        message: "Organization created successfully",
        organization: newOrg,
      }, 201);
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },
};
