/**
 * Utilities for formatting seat identifiers for clean frontend display.
 * Retains original database identifiers (e.g. "OFFICE-0001", "ROOM-0010") for
 * API calls, URLs, and DB queries, while stripping redundant leading zeros for UI presentation
 * (e.g. "OFFICE-1", "ROOM-10").
 */

/**
 * Formats a seat identifier by stripping leading zeros from the numeric suffix.
 * Handles dynamic prefixes (e.g., "OFFICE-0001" -> "OFFICE-1", "ROOM-0015" -> "ROOM-15").
 * If the input is already in clean format or doesn't match the pattern, it is returned safely.
 *
 * @param identifier The raw seat identifier (e.g. "OFFICE-0002", "ROOM-0001", "SEAT-0005")
 * @returns Clean display identifier (e.g. "OFFICE-2", "ROOM-1", "SEAT-5")
 */
export function formatSeatIdentifier(identifier?: string | null): string {
  if (!identifier) return "";
  const trimmed = String(identifier).trim();
  if (!trimmed) return "";

  // Match: Prefix followed by hyphen/underscore and digits (e.g. "OFFICE-0001", "ROOM_002")
  const match = trimmed.match(/^([A-Za-z0-9_-]+?[-_])0*(\d+)$/);
  if (match) {
    const [, prefix, numStr] = match;
    const num = parseInt(numStr, 10);
    return `${prefix}${num}`;
  }

  // If identifier is purely padded digits (e.g. "0001", "02")
  if (/^0+\d+$/.test(trimmed)) {
    return String(parseInt(trimmed, 10));
  }

  return trimmed;
}

/**
 * Formats a composite seat display label e.g. "Seat 01 • OFFICE-0001" -> "Seat 01 • OFFICE-1"
 */
export function formatSeatDisplay(seatNumber?: string | number | null, seatIdentifier?: string | null): string {
  const cleanId = formatSeatIdentifier(seatIdentifier);
  if (seatNumber && cleanId) {
    return `Seat ${seatNumber} • ${cleanId}`;
  }
  if (cleanId) return cleanId;
  if (seatNumber) return `Seat ${seatNumber}`;
  return "";
}

/**
 * Resolves the primary human-readable display identifier for a seat,
 * guaranteeing format `LOCATIONNAME-SEATNUMBER` (e.g. "OFFICE-1", "MEETING-ROOM-2").
 *
 * Prioritizes `seat.displayId`. If `seat.displayId` is missing or looks like an
 * internal UUID (e.g. `sea_...`), it computes `LOCATIONNAME-SEATNUMBER` using the
 * location name and seat number.
 */
export function getSeatDisplayIdentifier(
  seat?: { id?: string; displayId?: string; number?: string | number } | null,
  locationName?: string
): string {
  if (!seat) return "";

  // 1. Check displayId first
  const displayId = (seat.displayId || "").trim();
  if (displayId && !displayId.startsWith("sea_")) {
    return formatSeatIdentifier(displayId);
  }

  // 2. Check id if it is formatted like a human-readable identifier (not sea_...)
  const rawId = (seat.id || "").trim();
  if (rawId && !rawId.startsWith("sea_") && !rawId.startsWith("SEA-")) {
    return formatSeatIdentifier(rawId);
  }

  // 3. Fallback to LOCATIONNAME-SEATNUMBER using locationName and seat.number
  const locPrefix = (locationName || "OFFICE")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "-")
    .replace(/[^A-Z0-9-]+/g, "")
    .replace(/^-+|-+$/g, "") || "OFFICE";

  const num = seat.number !== undefined && seat.number !== null ? String(seat.number).trim() : "1";
  const parsedNum = parseInt(num, 10);
  const cleanNum = !isNaN(parsedNum) && parsedNum > 0 ? String(parsedNum) : num;

  return `${locPrefix}-${cleanNum}`;
}

