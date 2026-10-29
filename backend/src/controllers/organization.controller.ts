import { Context } from "hono";
import { getUniversalDb } from "../db";
import { AppEnv } from "../types";
import { getAuthUser } from "../middleware/auth.middleware";
import { getNextId } from "../utils/id-generator";

export interface OrganizationModel {
  id: string;
  displayId?: string;
  name: string;
  shortCode: string;
  currency: string;
  ownerUserId?: string;
  createdAt: string;
}

export const organizationController = {
  // GET /api/organizations?userId=xxx
  async getOrganizations(c: Context<AppEnv>) {
    try {
      const authUser = await getAuthUser(c);
      if (!authUser) {
        return c.json({ success: false, message: "Unauthorized. Please log in to view organizations." }, 401);
      }

      const db = getUniversalDb(c.env?.DB);
      const userId = c.req.query("userId") || authUser.id;

      // Ensure user can only query their own organizations unless they are Admin
      const targetUserId = authUser.userType === "Admin" ? userId : authUser.id;

      const rows = (await db
        .prepare(
          `SELECT o.id, o.display_id as displayId, o.name, o.short_code as shortCode, o.currency as currency, o.owner_user_id as ownerUserId, o.created_at as createdAt
           FROM organizations o
           JOIN user_organizations uo ON o.id = uo.organization_id
           WHERE uo.user_id = ?
           ORDER BY o.created_at DESC`
        )
        .bind(targetUserId)
        .all()) as any[];

      return c.json({ success: true, organizations: rows || [] });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },

  // POST /api/organizations
  async createOrganization(c: Context<AppEnv>) {
    try {
      const authUser = await getAuthUser(c);
      if (!authUser) {
        return c.json({ success: false, message: "Unauthorized. Please log in to create an organization." }, 401);
      }

      const body = await c.req.json();
      const name = (body.name || "").trim();
      const shortCode = (body.shortCode || "").trim().toUpperCase();
      const currency = (body.currency || "INR").trim().toUpperCase();
      const userId = body.userId ? String(body.userId) : authUser.id;
      const allowedCurrencies = ["INR", "USD", "AED", "GBP", "EUR"];

      if (!name || !shortCode) {
        return c.json({ success: false, message: "Organization name and shortCode are required" }, 400);
      }

      if (!allowedCurrencies.includes(currency)) {
        return c.json(
          { success: false, message: "Invalid currency" },
          400
        );
      }

      const db = getUniversalDb(c.env?.DB);
      const { displayId } = await getNextId(db, "ORG", shortCode);
      const orgId = `org_${shortCode.toLowerCase()}_${Date.now()}`;
      const now = new Date().toISOString();

      try {
        await db
          .prepare(
            `INSERT INTO organizations (id, display_id, name, short_code, currency, owner_user_id, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          )
          .run(orgId, displayId, name, shortCode, currency, userId || null, now);

        if (userId) {
          await db
            .prepare(
              `INSERT OR IGNORE INTO user_organizations (id, user_id, organization_id, role, created_at)
               VALUES (?, ?, ?, 'Owner', ?)`
            )
            .run(`uo_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, userId, orgId, now);
        }
      } catch (dbErr: any) {
        if (dbErr.message && dbErr.message.includes("UNIQUE")) {
          return c.json(
            {
              success: false,
              message: "Organization with this shortCode already exists",
            },
            409
          );
        }

        console.error("DB insert error:", dbErr);

        return c.json(
          {
            success: false,
            message: "Failed to create organization",
          },
          500
        );
      }

      const newOrg: OrganizationModel = {
        id: orgId,
        displayId,
        name,
        shortCode,
        currency,
        ownerUserId: userId || undefined,
        createdAt: now,
      };

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
