import { Context } from "hono";
import { getUniversalDb } from "../db";
import { AppEnv } from "../types";
import { getAuthUser } from "../middleware/auth.middleware";
import { getNextId, generateId } from "../utils/id-generator";
import { isSupportedCurrency, DEFAULT_CURRENCY } from "../utils/currencies";

export interface OrganizationModel {
  id: string;
  displayId?: string;
  name: string;
  shortCode: string;
  currency: string;
  currencyCode?: string;
  ownerUserId?: string;
  createdAt: string;
}

export const organizationController = {
  // GET /api/organizations/check-name?name=value
  async checkName(c: Context<AppEnv>) {
    try {
      const rawName = c.req.query("name") || "";
      const normalizedName = rawName.trim().replace(/\s+/g, " ");

      if (!normalizedName) {
        return c.json({ success: false, available: false, message: "Organization name is required" }, 400);
      }

      if (normalizedName.length < 2) {
        return c.json({ success: false, available: false, message: "Organization name must be at least 2 characters" }, 400);
      }

      const db = getUniversalDb(c.env?.DB);
      // Organization names do not need to be unique
      return c.json({
        success: true,
        available: true,
        message: "Organization name is valid.",
      });
    } catch (err: any) {
      console.error("checkName error:", err);
      return c.json({ success: false, message: "Error checking organization name availability" }, 500);
    }
  },

  // GET /api/organizations/check-code?code=value
  async checkCode(c: Context<AppEnv>) {
    try {
      const rawCode = c.req.query("code") || "";
      const normalizedCode = rawCode.trim().toUpperCase();

      if (!normalizedCode) {
        return c.json({ success: false, available: false, message: "Organization code is required" }, 400);
      }

      if (normalizedCode.length < 2) {
        return c.json({ success: false, available: false, message: "Organization code must be at least 2 characters" }, 400);
      }

      const db = getUniversalDb(c.env?.DB);
      const existing = (await db
        .prepare(`SELECT id, short_code FROM organizations WHERE LOWER(TRIM(short_code)) = LOWER(?)`)
        .bind(normalizedCode)
        .get()) as any;

      if (existing) {
        return c.json({
          success: true,
          available: false,
          message: "This organization code is already taken. Please choose another code.",
        });
      }

      return c.json({
        success: true,
        available: true,
        message: "Organization code is available.",
      });
    } catch (err: any) {
      console.error("checkCode error:", err);
      return c.json({ success: false, message: "Error checking organization code availability" }, 500);
    }
  },

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
          `SELECT o.id, o.display_id as displayId, o.name, o.short_code as shortCode, o.currency_code as currencyCode, o.currency_code as currency, o.owner_user_id as ownerUserId, o.created_at as createdAt
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
      const currency = (body.currencyCode || body.currency || DEFAULT_CURRENCY).trim().toUpperCase();
      const userId = body.userId ? String(body.userId) : authUser.id;

      if (!name || !shortCode) {
        return c.json({ success: false, message: "Organization name and shortCode are required" }, 400);
      }

      if (!isSupportedCurrency(currency)) {
        return c.json(
          { success: false, message: "Invalid currency" },
          400
        );
      }

      const db = getUniversalDb(c.env?.DB);
      const orgId = await generateId(db, "ORG");
      const displayId = orgId;
      const now = new Date().toISOString();

      try {
        await db
          .prepare(
            `INSERT INTO organizations (id, display_id, name, short_code, currency_code, owner_user_id, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          )
          .run(orgId, displayId, name, shortCode, currency, userId || null, now);

        if (userId) {
          const uorId = await generateId(db, "UOR");
          await db
            .prepare(
              `INSERT OR IGNORE INTO user_organizations (id, user_id, organization_id, role, created_at)
               VALUES (?, ?, ?, 'Owner', ?)`
            )
            .run(uorId, userId, orgId, now);
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
        currencyCode: currency,
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

  // GET /api/organizations/:id
  async getOrganization(c: Context<AppEnv>) {
    try {
      const idOrCode = c.req.param("id") || "";
      if (!idOrCode) {
        return c.json({ success: false, message: "Organization ID or code required" }, 400);
      }
      const db = getUniversalDb(c.env?.DB);
      const org = (await db
        .prepare(
          `SELECT id, display_id as displayId, name, short_code as shortCode, currency_code as currencyCode, currency_code as currency, owner_user_id as ownerUserId, created_at as createdAt
           FROM organizations
           WHERE id = ? OR UPPER(short_code) = UPPER(?)`
        )
        .bind(idOrCode, idOrCode)
        .get()) as any;

      if (!org) {
        return c.json({ success: false, message: "Organization not found" }, 404);
      }

      return c.json({ success: true, organization: org });
    } catch (err: any) {
      return c.json({ success: false, message: err.message }, 500);
    }
  },
};
