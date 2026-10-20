import { Context } from "hono";
import { getUniversalDb } from "../db";
import { resolveAuthorizedOrg } from "../middleware/auth.middleware";
import {
  BreakSession,
  DEFAULT_BREAK_SESSIONS,
  validateOrderingWindow,
  calculateDurationMinutes,
} from "../utils/session-window";

export interface WorkingHoursModel {
  openTime: string;
  closeTime: string;
  timezone: string;
  isEmergencyClosed: boolean;
  breakSessions: BreakSession[];
  updatedAt: string;
}

export const workingHoursController = {
  /**
   * GET /api/working-hours
   * Returns working hours, timezone, emergency override status, and 5 break sessions.
   */
  async getWorkingHours(c: Context) {
    try {
      const db = getUniversalDb(c.env?.DB);
      const authorizedOrg = await resolveAuthorizedOrg(c, { allowPublic: true });
      const orgId = authorizedOrg?.organizationId;

      let row: any = null;
      if (orgId) {
        row = await db
          .prepare("SELECT * FROM working_hours WHERE organization_id = ?")
          .bind(orgId)
          .get();
      }

      let breakSessions: BreakSession[] = DEFAULT_BREAK_SESSIONS;
      if (row?.break_sessions_json) {
        try {
          const parsed = JSON.parse(row.break_sessions_json);
          if (Array.isArray(parsed) && parsed.length > 0) {
            breakSessions = parsed;
          }
        } catch {}
      }

      const openTime = row?.open_time || "08:00";
      const closeTime = row?.close_time || "20:00";
      const timezone = row?.timezone || "Asia/Dubai";
      const isEmergencyClosed = Boolean(row?.is_emergency_closed);
      const updatedAt = row?.updated_at || new Date().toISOString();

      // Also compute current status for frontend preview
      const windowStatus = await validateOrderingWindow(db, orgId || "default");

      return c.json({
        success: true,
        workingHours: {
          openTime,
          closeTime,
          timezone,
          isEmergencyClosed,
          breakSessions,
          updatedAt,
        },
        windowStatus,
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
          breakSessions: DEFAULT_BREAK_SESSIONS,
          updatedAt: new Date().toISOString(),
        },
      });
    }
  },

  /**
   * PUT /api/working-hours
   * Saves openTime, closeTime, timezone, emergency override, and break sessions.
   * Scoped to the caller's organization.
   */
  async updateWorkingHours(c: Context) {
    try {
      const db = getUniversalDb(c.env?.DB);
      const authorizedOrg = await resolveAuthorizedOrg(c);
      const orgId = authorizedOrg?.organizationId;

      if (!orgId) {
        return c.json({ success: false, message: "Organization required" }, 400);
      }

      const body = await c.req.json();
      const openTime = body.openTime?.trim() || "08:00";
      const closeTime = body.closeTime?.trim() || "20:00";
      const timezone = body.timezone?.trim() || "Asia/Dubai";
      const isEmergencyClosed = body.isEmergencyClosed ? 1 : 0;
      const rawBreaks = Array.isArray(body.breakSessions) ? body.breakSessions : DEFAULT_BREAK_SESSIONS;

      // Limit to max 5 break sessions and sanitize each session
      if (rawBreaks.length > 5) {
        return c.json({ success: false, message: "Maximum 5 break sessions are allowed." }, 400);
      }

      const sanitizedBreaks: BreakSession[] = rawBreaks.slice(0, 5).map((b: any, index: number) => {
        const startTime = (b.startTime || "09:00").trim();
        const endTime = (b.endTime || "09:15").trim();
        const durationMinutes = calculateDurationMinutes(startTime, endTime);
        return {
          id: b.id || `break_${index + 1}`,
          name: b.name || `Break ${index + 1}`,
          startTime,
          endTime,
          durationMinutes,
          isEnabled: typeof b.isEnabled === "boolean" ? b.isEnabled : true,
        };
      });

      // Validation 1: Break start time must precede end time (or handle overnight)
      for (const b of sanitizedBreaks) {
        if (!b.startTime || !b.endTime) {
          return c.json({ success: false, message: `Please provide start and end time for ${b.name}.` }, 400);
        }
        if (b.startTime === b.endTime) {
          return c.json({ success: false, message: `${b.name} start time and end time cannot be identical.` }, 400);
        }
      }

      // Validation 2: Ensure enabled breaks do not overlap
      const enabledBreaks = sanitizedBreaks.filter((b) => b.isEnabled);
      for (let i = 0; i < enabledBreaks.length; i++) {
        for (let j = i + 1; j < enabledBreaks.length; j++) {
          const b1 = enabledBreaks[i];
          const b2 = enabledBreaks[j];
          // Check overlap in simple daytime hours: start1 < end2 && start2 < end1
          if (b1.startTime < b2.endTime && b2.startTime < b1.endTime) {
            return c.json(
              {
                success: false,
                message: `Break sessions conflict: "${b1.name}" (${b1.startTime} - ${b1.endTime}) overlaps with "${b2.name}" (${b2.startTime} - ${b2.endTime}).`,
              },
              400
            );
          }
        }
      }

      // Ensure table exists safely if running on a newly provisioned database
      try {
        await db.exec(`
          CREATE TABLE IF NOT EXISTS working_hours (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL UNIQUE,
            open_time TEXT NOT NULL DEFAULT '08:00',
            close_time TEXT NOT NULL DEFAULT '20:00',
            timezone TEXT NOT NULL DEFAULT 'Asia/Dubai',
            is_emergency_closed INTEGER NOT NULL DEFAULT 0,
            break_sessions_json TEXT DEFAULT '[]',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
          );
        `);
      } catch (tableErr) {
        // Table may already exist
      }

      const breakSessionsJson = JSON.stringify(sanitizedBreaks);
      const now = new Date().toISOString();
      const whId = `wh_${orgId}`;

      await db
        .prepare(
          `INSERT INTO working_hours (id, organization_id, open_time, close_time, timezone, is_emergency_closed, break_sessions_json, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(organization_id) DO UPDATE SET
             open_time = excluded.open_time,
             close_time = excluded.close_time,
             timezone = excluded.timezone,
             is_emergency_closed = excluded.is_emergency_closed,
             break_sessions_json = excluded.break_sessions_json,
             updated_at = excluded.updated_at`
        )
        .bind(whId, orgId, openTime, closeTime, timezone, isEmergencyClosed, breakSessionsJson, now, now)
        .run();

      const windowStatus = await validateOrderingWindow(db, orgId);

      return c.json({
        success: true,
        message: "Working hours settings saved successfully.",
        workingHours: {
          openTime,
          closeTime,
          timezone,
          isEmergencyClosed: Boolean(isEmergencyClosed),
          breakSessions: sanitizedBreaks,
          updatedAt: now,
        },
        windowStatus,
      });
    } catch (err: any) {
      console.error("Error updating working hours:", err);
      return c.json({ success: false, message: err.message }, 500);
    }
  },
};
