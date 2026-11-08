import { Context } from "hono";
import { getUniversalDb } from "../db";
import { generateId } from "../utils/id-generator";
import { resolveAuthorizedOrg } from "../middleware/auth.middleware";
import {
  BreakSession,
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
   * Returns working hours, timezone, emergency override status, and break sessions.
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

      let breakSessions: BreakSession[] = [];
      if (row) {
        if (row.break_sessions_json != null) {
          try {
            const parsed = JSON.parse(row.break_sessions_json);
            if (Array.isArray(parsed)) {
              breakSessions = parsed.map((b: any, index: number) => ({
                id: b.id ? String(b.id) : `break_${index + 1}`,
                name: (b.name || `Break ${index + 1}`).trim(),
                startTime: (b.startTime || "09:00").trim(),
                endTime: (b.endTime || "09:15").trim(),
                durationMinutes:
                  typeof b.durationMinutes === "number" && b.durationMinutes > 0
                    ? b.durationMinutes
                    : (typeof b.duration === "number" && b.duration > 0
                      ? b.duration
                      : calculateDurationMinutes(b.startTime, b.endTime)),
                isEnabled:
                  typeof b.isEnabled === "boolean"
                    ? b.isEnabled
                    : (typeof b.enabled === "boolean" ? b.enabled : true),
              }));
            }
          } catch (e) {
            console.warn("Could not parse break_sessions_json from DB:", e);
          }
        }
      }

      const openTime = row?.open_time || "08:00";
      const closeTime = row?.close_time || "20:00";
      const timezone = row?.timezone || "Asia/Dubai";
      const isEmergencyClosed = Boolean(row?.is_emergency_closed);
      const updatedAt = row?.updated_at || new Date().toISOString();

      // Also compute current status for frontend preview
      const windowStatus = await validateOrderingWindow(db, orgId || "default");

      c.header("Cache-Control", "no-store, no-cache, must-revalidate");
      c.header("Pragma", "no-cache");

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
      return c.json(
        {
          success: false,
          message: err.message || "Failed to load working hours.",
        },
        500
      );
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
      const rawBreaks = Array.isArray(body.breakSessions) ? body.breakSessions : [];

      const sanitizedBreaks: BreakSession[] = rawBreaks.map((b: any, index: number) => {
        const name = (b.name || "").trim();
        const startTime = (b.startTime || "").trim();
        const endTime = (b.endTime || "").trim();
        const durationMinutes =
          typeof b.durationMinutes === "number" && b.durationMinutes > 0
            ? b.durationMinutes
            : (typeof b.duration === "number" && b.duration > 0
              ? b.duration
              : calculateDurationMinutes(startTime, endTime));
        const isEnabled =
          typeof b.isEnabled === "boolean"
            ? b.isEnabled
            : (typeof b.enabled === "boolean" ? b.enabled : true);

        return {
          id: b.id ? String(b.id) : `break_${Date.now()}_${index + 1}`,
          name: name || `Break ${index + 1}`,
          startTime,
          endTime,
          durationMinutes,
          isEnabled,
        };
      });

      // Validation 1: Required fields & time order
      for (const b of sanitizedBreaks) {
        if (!b.name || !b.name.trim()) {
          return c.json({ success: false, message: "Break name cannot be empty." }, 400);
        }
        if (!b.startTime) {
          return c.json({ success: false, message: `Start time is required for "${b.name}".` }, 400);
        }
        if (!b.endTime) {
          return c.json({ success: false, message: `End time is required for "${b.name}".` }, 400);
        }
        if (b.startTime >= b.endTime) {
          return c.json({ success: false, message: `End time must be later than start time for "${b.name}".` }, 400);
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

      const breakSessionsJson = JSON.stringify(sanitizedBreaks);
      const now = new Date().toISOString();
      const existingWh = (await db.prepare(`SELECT id FROM working_hours WHERE organization_id = ?`).bind(orgId).get()) as any;
      const whId = existingWh?.id || (await generateId(db, "WHR"));

      try {
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
      } catch (insertErr: any) {
        if (insertErr?.message && insertErr.message.includes("no such table")) {
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
        } else {
          throw insertErr;
        }
      }

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
      return c.json({ success: false, message: err.message || "Failed to update working hours." }, 500);
    }
  },
};
