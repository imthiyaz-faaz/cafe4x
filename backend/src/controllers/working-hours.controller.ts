import { Context } from "hono";
import { getUniversalDb } from "../db";
import { resolveAuthorizedOrg } from "../middleware/auth.middleware";

export interface WorkingHoursModel {
  openTime: string;
  closeTime: string;
  timezone: string;
  isEmergencyClosed: boolean;
  updatedAt: string;
}

export const workingHoursController = {
  async getWorkingHours(c: Context) {
    try {
      const db = getUniversalDb(c.env?.DB);
      const authorizedOrg = await resolveAuthorizedOrg(c);
      const orgId = authorizedOrg?.organizationId;

      let row: any = null;
      if (orgId) {
        row = await db
          .prepare("SELECT * FROM working_hours WHERE organization_id = ?")
          .bind(orgId)
          .get();
      }

      if (!row) {
        return c.json({
          success: true,
          workingHours: {
            openTime: "08:00",
            closeTime: "20:00",
            timezone: "Asia/Dubai",
            isEmergencyClosed: false,
            updatedAt: new Date().toISOString(),
          },
        });
      }

      return c.json({
        success: true,
        workingHours: {
          openTime: row.open_time || "08:00",
          closeTime: row.close_time || "20:00",
          timezone: row.timezone || "Asia/Dubai",
          isEmergencyClosed: Boolean(row.is_emergency_closed),
          updatedAt: row.updated_at || new Date().toISOString(),
        },
      });
    } catch (err: any) {
      console.error("Error getting working hours:", err);
      return c.json({
        success: true,
        workingHours: {
          openTime: "08:00",
          closeTime: "20:00",
          timezone: "Asia/Dubai",
          isEmergencyClosed: false,
          updatedAt: new Date().toISOString(),
        },
      });
    }
  },

  async updateWorkingHours(c: Context) {
    try {
      const db = getUniversalDb(c.env?.DB);
      const authorizedOrg = await resolveAuthorizedOrg(c);
      const orgId = authorizedOrg?.organizationId;


      if (!orgId) {
        return c.json({ success: false, message: "Organization required" }, 400);
      }

      const body = await c.req.json();
      const openTime = body.openTime || "08:00";
      const closeTime = body.closeTime || "20:00";
      const timezone = body.timezone || "Asia/Dubai";
      const isEmergencyClosed = body.isEmergencyClosed ? 1 : 0;
      const now = new Date().toISOString();
      const whId = `wh_${orgId}`;

      await db
        .prepare(
          `INSERT INTO working_hours (id, organization_id, open_time, close_time, timezone, is_emergency_closed, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(organization_id) DO UPDATE SET
             open_time = excluded.open_time,
             close_time = excluded.close_time,
             timezone = excluded.timezone,
             is_emergency_closed = excluded.is_emergency_closed,
             updated_at = excluded.updated_at`
        )
        .bind(whId, orgId, openTime, closeTime, timezone, isEmergencyClosed, now, now)
        .run();

      return c.json({
        success: true,
        workingHours: {
          openTime,
          closeTime,
          timezone,
          isEmergencyClosed: Boolean(isEmergencyClosed),
          updatedAt: now,
        },
      });
    } catch (err: any) {
      console.error("Error updating working hours:", err);
      return c.json({ success: false, message: err.message }, 500);
    }
  },
};

