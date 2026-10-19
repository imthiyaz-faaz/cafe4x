// Utility for Timezone-Aware Order Period Classification & Financial Aggregation

export interface OrderPeriodConfig {
  morningStart: string; // "06:00"
  morningEnd: string;   // "11:59"
  eveningStart: string; // "16:00"
  eveningEnd: string;   // "23:59"
}

export const DEFAULT_ORDER_PERIODS: OrderPeriodConfig = {
  morningStart: "06:00",
  morningEnd: "11:59",
  eveningStart: "16:00",
  eveningEnd: "23:59",
};

export type PeriodClassification = "morning" | "evening" | "other";

/**
 * Parses an ISO date/timestamp and extracts local time "HH:mm" in the specified timezone
 */
export function getTimeInTimezone(dateString: string, timezone: string = "Asia/Dubai"): { timeStr: string; dateStr: string; displayTime: string } {
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) {
      return { timeStr: "00:00", dateStr: "", displayTime: dateString };
    }

    // Format YYYY-MM-DD
    const formatterDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const dateStr = formatterDate.format(d);

    // Format 24-hr HH:mm
    const formatterTime = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const timeStr = formatterTime.format(d);

    // Display 12-hr with AM/PM
    const formatterDisplay = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
    const displayTime = formatterDisplay.format(d);

    return { timeStr, dateStr, displayTime };
  } catch {
    return { timeStr: "00:00", dateStr: "", displayTime: dateString };
  }
}

/**
 * Classifies an order into "morning", "evening", or "other" based on its creation timestamp and configured periods
 */
export function classifyOrderPeriod(
  createdAt: string,
  timezone: string = "Asia/Dubai",
  config: OrderPeriodConfig = DEFAULT_ORDER_PERIODS
): PeriodClassification {
  const { timeStr } = getTimeInTimezone(createdAt, timezone);
  if (!timeStr) return "other";

  if (timeStr >= config.morningStart && timeStr <= config.morningEnd) {
    return "morning";
  }
  if (timeStr >= config.eveningStart && timeStr <= config.eveningEnd) {
    return "evening";
  }
  return "other";
}

/**
 * Returns today's and yesterday's YYYY-MM-DD string in the specified timezone
 */
export function getDateStringsInTimezone(timezone: string = "Asia/Dubai") {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const todayStr = formatter.format(now);

  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStr = formatter.format(yesterday);

  return { todayStr, yesterdayStr };
}
