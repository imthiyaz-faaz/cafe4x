/**
 * Utilities for formatting seat identifiers for clean frontend display.
 * Retains original database identifiers (e.g. "ORG-000001-LOC-000001-SEAT-001") for
 * API calls, URLs, and DB queries, while displaying clean, friendly identifiers without leading zeros (e.g. "OFFICE-1").
 */

/**
 * Formats a seat identifier for clean presentation without leading zeros.
 * - If the ID is the global format "ORG-000001-LOC-000001-SEAT-001", extracts "SEAT-1".
 * - If a friendly prefix like "OFFICE-001" or "OFFICE-0001", normalizes to "OFFICE-1".
 *
 * @param identifier The raw seat identifier (e.g. "ORG-000001-LOC-000001-SEAT-001", "OFFICE-001")
 * @returns Clean display identifier (e.g. "OFFICE-1", "SEAT-1")
 */
export function formatSeatIdentifier(identifier?: string | null, locationName?: string): string {
  if (!identifier) return "";
  const trimmed = String(identifier).trim();
  if (!trimmed) return "";

  // Check if it's the global composite format ORG-XXXXXX-LOC-XXXXXX-SEAT-XXX
  const globalMatch = trimmed.match(/^ORG-\d+-LOC-\d+-SEAT-0*(\d+)$/i);
  if (globalMatch) {
    const seatNum = parseInt(globalMatch[1], 10) || globalMatch[1];
    if (locationName) {
      const locPrefix = locationName
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "-")
        .replace(/[^A-Z0-9-]+/g, "")
        .replace(/^-+|-+$/g, "") || "OFFICE";
      return `${locPrefix}-${seatNum}`;
    }
    return `SEAT-${seatNum}`;
  }

  // If friendly identifier like OFFICE-001 or LOC-0001, strip leading zeros from number
  const prefixMatch = trimmed.match(/^([A-Za-z0-9_-]+?[-_])0*(\d+)$/);
  if (prefixMatch) {
    const num = parseInt(prefixMatch[2], 10);
    return `${prefixMatch[1]}${!isNaN(num) ? num : prefixMatch[2]}`;
  }

  return trimmed;
}

/**
 * Formats a composite seat display label e.g. "Seat 1 • OFFICE-1"
 */
export function formatSeatDisplay(seatNumber?: string | number | null, seatIdentifier?: string | null): string {
  const cleanId = formatSeatIdentifier(seatIdentifier);
  const cleanNum = seatNumber !== undefined && seatNumber !== null
    ? String(parseInt(String(seatNumber), 10) || seatNumber)
    : "";

  if (cleanNum && cleanId) {
    return `Seat ${cleanNum} • ${cleanId}`;
  }
  if (cleanId) return cleanId;
  if (cleanNum) return `Seat ${cleanNum}`;
  return "";
}

/**
 * Resolves the primary friendly human-readable display identifier for a seat,
 * guaranteeing format `LOCATIONNAME-SEATNUMBER` with NO leading zeros (e.g. "OFFICE-1", "OFFICE-2").
 *
 * Prioritizes `seat.displayId`. If `seat.displayId` is missing or looks like an
 * internal UUID or global ID, it computes `LOCATIONNAME-SEATNUMBER` using the
 * location name and seat number (without leading zeros e.g. OFFICE-1).
 */
export function getSeatDisplayIdentifier(
  seat?: { id?: string; displayId?: string; number?: string | number } | null,
  locationName?: string
): string {
  if (!seat) return "";

  const locPrefix = (locationName || "OFFICE")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "-")
    .replace(/[^A-Z0-9-]+/g, "")
    .replace(/^-+|-+$/g, "") || "OFFICE";

  const num = seat.number !== undefined && seat.number !== null ? String(seat.number).trim() : "1";
  const parsedNum = parseInt(num, 10);
  const unpaddedNum = !isNaN(parsedNum) && parsedNum > 0 ? String(parsedNum) : num.replace(/^0+/, "") || "1";

  // 1. Check displayId first
  const displayId = (seat.displayId || "").trim();
  if (displayId && !displayId.startsWith("sea_") && !displayId.startsWith("ORG-")) {
    const m = displayId.match(/^([A-Za-z0-9_-]+?[-_])0*(\d+)$/);
    if (m) {
      const p = parseInt(m[2], 10);
      return `${m[1]}${!isNaN(p) ? p : m[2]}`;
    }
    return displayId;
  }

  // 2. Check id if it is formatted like a human-readable identifier (not sea_... and not ORG-...)
  const rawId = (seat.id || "").trim();
  if (rawId && !rawId.startsWith("sea_") && !rawId.startsWith("ORG-")) {
    const m = rawId.match(/^([A-Za-z0-9_-]+?[-_])0*(\d+)$/);
    if (m) {
      const p = parseInt(m[2], 10);
      return `${m[1]}${!isNaN(p) ? p : m[2]}`;
    }
    return rawId;
  }

  // 3. Guaranteed friendly identifier e.g. OFFICE-1
  return `${locPrefix}-${unpaddedNum}`;
}

/**
 * Universal Formatter for Order Seat Display.
 * Formats orders consistently into:
 * `Table Name - Seat Number (Location Name)`
 *
 * Examples:
 * - `Table 1 - Seat 1 (Meeting Hall)`
 * - `Table 1 - Seat 2 (Meeting Hall)`
 * - `Main Table - Seat 3 (Meeting Hall)`
 *
 * Safely falls back if table name or seat number is missing, and extracts
 * the seat number from composite identifiers like "ORG-000001-LOC-000004-SEAT-001".
 */
export function formatOrderSeat(
  order?: {
    seat?: string | null;
    seatId?: string | null;
    seatNumber?: string | number | null;
    tableName?: string | null;
    locationName?: string | null;
    seatDisplay?: string | null;
  } | null,
  fallbackLocation?: string | null
): string {
  if (!order) return "Seat";

  // If backend already prepared seatDisplay, return it
  if (order.seatDisplay && typeof order.seatDisplay === "string" && order.seatDisplay.trim()) {
    return order.seatDisplay.trim();
  }

  const rawSeat = (order.seatId || order.seat || "").trim();
  const locationName = (order.locationName || fallbackLocation || "").trim();
  const locSuffix = locationName ? ` (${locationName})` : "";

  // 1. Check if order object has explicit tableName and seatNumber
  if (order.tableName && (order.seatNumber !== undefined && order.seatNumber !== null && String(order.seatNumber).trim() !== "")) {
    const sNum = parseInt(String(order.seatNumber), 10) || order.seatNumber;
    return `${order.tableName} - Seat ${sNum}${locSuffix}`;
  }

  // 2. Try parsing rawSeat if it matches ORG-XXXXXX-LOC-XXXXXX-SEAT-0*(\d+)
  const globalMatch = rawSeat.match(/^ORG-\d+-LOC-\d+-SEAT-0*(\d+)$/i);
  if (globalMatch) {
    const seatNum = parseInt(globalMatch[1], 10) || globalMatch[1];
    const tablePrefix = order.tableName || "Table 1";
    return `${tablePrefix} - Seat ${seatNum}${locSuffix}`;
  }

  // 3. Try parsing prefix-number pattern e.g. "OFFICE-001", "SEAT-004", "T1-S2"
  const prefixMatch = rawSeat.match(/^(?:.*-)?0*(\d+)$/);
  if (prefixMatch && prefixMatch[1]) {
    const seatNum = parseInt(prefixMatch[1], 10) || prefixMatch[1];
    const tablePrefix = order.tableName || "Table 1";
    return `${tablePrefix} - Seat ${seatNum}${locSuffix}`;
  }

  // 4. Fallback if only rawSeat or seatNumber exists
  if (order.tableName) {
    return `${order.tableName}${locSuffix}`;
  }
  if (rawSeat) {
    return `Seat ${rawSeat}${locSuffix}`;
  }

  return locationName ? `Seat (${locationName})` : "Seat";
}

/**
 * Short Seat Badge Label (for compact badges/pills on queue cards or chairs).
 * e.g. "Seat 1" or "S1"
 */
export function formatOrderSeatNumber(
  order?: {
    seat?: string | null;
    seatId?: string | null;
    seatNumber?: string | number | null;
  } | null
): string {
  if (!order) return "—";
  if (order.seatNumber !== undefined && order.seatNumber !== null && String(order.seatNumber).trim() !== "") {
    const sNum = parseInt(String(order.seatNumber), 10) || order.seatNumber;
    return String(sNum);
  }
  const rawSeat = (order.seatId || order.seat || "").trim();
  const globalMatch = rawSeat.match(/^ORG-\d+-LOC-\d+-SEAT-0*(\d+)$/i);
  if (globalMatch) {
    const seatNum = parseInt(globalMatch[1], 10) || globalMatch[1];
    return String(seatNum);
  }
  const prefixMatch = rawSeat.match(/^(?:.*-)?0*(\d+)$/);
  if (prefixMatch && prefixMatch[1]) {
    return String(parseInt(prefixMatch[1], 10) || prefixMatch[1]);
  }
  return rawSeat.substring(0, 8);
}


