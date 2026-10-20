import { UniversalDb } from "../db";

export interface BreakSession {
  id: string; // e.g. "break_1"
  name: string; // e.g. "Break 1"
  startTime: string; // e.g. "09:30"
  endTime: string; // e.g. "09:45"
  durationMinutes: number; // e.g. 15
  isEnabled: boolean;
}

export interface OrderingWindowStatus {
  allowed: boolean;
  reason?: string;
  openTime: string;
  closeTime: string;
  timezone: string;
  currentTimeInTz: string;
  isEmergencyClosed: boolean;
  currentBreak?: BreakSession | null;
  nextBreak?: BreakSession | null;
  breakSessions: BreakSession[];
}

export const DEFAULT_BREAK_SESSIONS: BreakSession[] = [
  { id: "break_1", name: "Break 1", startTime: "09:30", endTime: "09:45", durationMinutes: 15, isEnabled: true },
  { id: "break_2", name: "Break 2", startTime: "11:30", endTime: "11:45", durationMinutes: 15, isEnabled: true },
  { id: "break_3", name: "Break 3", startTime: "13:30", endTime: "14:00", durationMinutes: 30, isEnabled: true },
  { id: "break_4", name: "Break 4", startTime: "16:00", endTime: "16:15", durationMinutes: 15, isEnabled: true },
  { id: "break_5", name: "Break 5", startTime: "18:00", endTime: "18:15", durationMinutes: 15, isEnabled: true },
];

/**
 * Calculates duration in minutes between HH:MM and HH:MM
 */
export function calculateDurationMinutes(startTime: string, endTime: string): number {
  if (!startTime || !endTime) return 0;
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return 0;
  const startTotal = sh * 60 + sm;
  const endTotal = eh * 60 + em;
  if (endTotal >= startTotal) {
    return endTotal - startTotal;
  }
  // Crosses midnight
  return 24 * 60 - startTotal + endTotal;
}

/**
 * Validates whether order placement is currently allowed for the given organization,
 * checking:
 * 1. Emergency closure override (blocks all non-admin ordering immediately)
 * 2. Cafe open/close working hours (in organization's configured timezone)
 * 3. Active enabled employee break session (employees can ONLY order during enabled breaks)
 *
 * @param db Database instance
 * @param organizationId Organization identifier
 * @param options Options including role (Admin/Provider can bypass break restriction if cafe is open)
 * @param referenceDate Date instance to validate against (defaults to now)
 */
export async function validateOrderingWindow(
  db: UniversalDb,
  organizationId: string,
  options: { isPrivilegedStaff?: boolean } = {},
  referenceDate: Date = new Date()
): Promise<OrderingWindowStatus> {
  let row: any = null;
  try {
    row = await db
      .prepare(
        `SELECT open_time, close_time, timezone, is_emergency_closed, break_sessions_json
         FROM working_hours
         WHERE organization_id = ?`
      )
      .bind(organizationId)
      .get();
  } catch (err) {
    console.warn("Could not query working_hours table:", err);
  }

  const openTime = row?.open_time || "08:00";
  const closeTime = row?.close_time || "20:00";
  const timezone = row?.timezone || "Asia/Dubai";
  const isEmergencyClosed = Boolean(row?.is_emergency_closed);

  let breakSessions: BreakSession[] = DEFAULT_BREAK_SESSIONS;
  if (row?.break_sessions_json) {
    try {
      const parsed = JSON.parse(row.break_sessions_json);
      if (Array.isArray(parsed)) {
        breakSessions = parsed;
      }
    } catch (e) {
      console.warn("Could not parse break_sessions_json:", e);
    }
  }

  // Format current server time in the organization's configured timezone
  let currentTimeInTz = "00:00";
  try {
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    currentTimeInTz = formatter.format(referenceDate);
  } catch (tzErr) {
    const utcFormatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: "UTC",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    currentTimeInTz = utcFormatter.format(referenceDate);
  }

  // 1. Emergency override check
  if (isEmergencyClosed) {
    return {
      allowed: false,
      reason: "The cafe is temporarily closed due to an emergency override. Please check back later.",
      openTime,
      closeTime,
      timezone,
      currentTimeInTz,
      isEmergencyClosed: true,
      breakSessions,
      currentBreak: null,
      nextBreak: null,
    };
  }

  // 2. Check cafe working hours
  let isInWorkingHours = false;
  if (openTime <= closeTime) {
    isInWorkingHours = currentTimeInTz >= openTime && currentTimeInTz <= closeTime;
  } else {
    // Overnight window
    isInWorkingHours = currentTimeInTz >= openTime || currentTimeInTz <= closeTime;
  }

  if (!isInWorkingHours) {
    return {
      allowed: false,
      reason: `The cafe is currently closed. Operating hours: ${openTime} – ${closeTime} (${timezone}). Current time: ${currentTimeInTz}.`,
      openTime,
      closeTime,
      timezone,
      currentTimeInTz,
      isEmergencyClosed: false,
      breakSessions,
      currentBreak: null,
      nextBreak: null,
    };
  }

  // If the requester is an authorized Admin or Provider, they can manage and order outside employee breaks
  if (options.isPrivilegedStaff) {
    return {
      allowed: true,
      openTime,
      closeTime,
      timezone,
      currentTimeInTz,
      isEmergencyClosed: false,
      breakSessions,
      currentBreak: null,
      nextBreak: null,
    };
  }

  // 3. Check Employee Break Sessions
  const enabledBreaks = breakSessions.filter((b) => b.isEnabled);

  let activeBreak: BreakSession | null = null;
  for (const b of enabledBreaks) {
    if (b.startTime <= b.endTime) {
      if (currentTimeInTz >= b.startTime && currentTimeInTz < b.endTime) {
        activeBreak = b;
        break;
      }
    } else {
      // Overnight break
      if (currentTimeInTz >= b.startTime || currentTimeInTz < b.endTime) {
        activeBreak = b;
        break;
      }
    }
  }

  // Find next upcoming enabled break today
  let nextBreak: BreakSession | null = null;
  const sortedUpcoming = enabledBreaks
    .filter((b) => b.startTime > currentTimeInTz)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  if (sortedUpcoming.length > 0) {
    nextBreak = sortedUpcoming[0];
  } else if (enabledBreaks.length > 0) {
    // Earliest break tomorrow
    nextBreak = [...enabledBreaks].sort((a, b) => a.startTime.localeCompare(b.startTime))[0];
  }

  if (activeBreak) {
    return {
      allowed: true,
      openTime,
      closeTime,
      timezone,
      currentTimeInTz,
      isEmergencyClosed: false,
      breakSessions,
      currentBreak: activeBreak,
      nextBreak,
    };
  }

  // Outside enabled break sessions
  const nextMsg = nextBreak
    ? ` Next ordering session is ${nextBreak.name} (${nextBreak.startTime} – ${nextBreak.endTime}).`
    : " No upcoming break sessions configured.";

  return {
    allowed: false,
    reason: `Ordering is closed. Employees can only place orders during scheduled break sessions.${nextMsg} (Current time: ${currentTimeInTz} ${timezone})`,
    openTime,
    closeTime,
    timezone,
    currentTimeInTz,
    isEmergencyClosed: false,
    breakSessions,
    currentBreak: null,
    nextBreak,
  };
}
