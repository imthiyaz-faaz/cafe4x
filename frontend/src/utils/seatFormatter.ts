/**
 * Utilities for formatting seat identifiers for clean frontend display.
 * Retains original database identifiers (e.g. "ORG-000001-LOC-000001-SEAT-001") for
 * API calls, URLs, and DB queries, while displaying clean, friendly identifiers (e.g. "OFFICE-001").
 */

/**
 * Formats a seat identifier for clean presentation.
 * - If the ID is the global format "ORG-000001-LOC-000001-SEAT-001", extracts "SEAT-001" or friendly suffix.
 * - If already a friendly prefix like "OFFICE-001", preserves it.
 *
 * @param identifier The raw seat identifier (e.g. "ORG-000001-LOC-000001-SEAT-001", "OFFICE-001")
 * @returns Clean display identifier (e.g. "OFFICE-001", "SEAT-001")
 */
export function formatSeatIdentifier(identifier?: string | null): string {
  if (!identifier) return "";
  const trimmed = String(identifier).trim();
  if (!trimmed) return "";

  // Check if it's the global composite format ORG-XXXXXX-LOC-XXXXXX-SEAT-XXX
  const globalMatch = trimmed.match(/^ORG-\d+-LOC-\d+-(SEAT-\d+)$/i);
  if (globalMatch) {
    return globalMatch[1].toUpperCase();
  }

  return trimmed;
}

/**
 * Formats a composite seat display label e.g. "Seat 01 • OFFICE-001"
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
 * Resolves the primary friendly human-readable display identifier for a seat,
 * guaranteeing format `LOCATIONNAME-SEATNUMBER` (e.g. "OFFICE-001", "MEETING-ROOM-002").
 *
 * Prioritizes `seat.displayId`. If `seat.displayId` is missing or looks like an
 * internal UUID or global ID, it computes `LOCATIONNAME-SEATNUMBER` using the
 * location name and seat number (padded to 3 digits e.g. OFFICE-001).
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
  const paddedNum = !isNaN(parsedNum) && parsedNum > 0 ? String(parsedNum).padStart(3, "0") : num.padStart(3, "0");

  // 1. Check displayId first
  const displayId = (seat.displayId || "").trim();
  if (displayId && !displayId.startsWith("sea_") && !displayId.startsWith("ORG-")) {
    // If it has location prefix, ensure 3-digit padding
    const m = displayId.match(/^([A-Za-z0-9_-]+?[-_])0*(\d+)$/);
    if (m) {
      const p = parseInt(m[2], 10);
      return `${m[1]}${String(p).padStart(3, "0")}`;
    }
    return displayId;
  }

  // 2. Check id if it is formatted like a human-readable identifier (not sea_... and not ORG-...)
  const rawId = (seat.id || "").trim();
  if (rawId && !rawId.startsWith("sea_") && !rawId.startsWith("ORG-")) {
    const m = rawId.match(/^([A-Za-z0-9_-]+?[-_])0*(\d+)$/);
    if (m) {
      const p = parseInt(m[2], 10);
      return `${m[1]}${String(p).padStart(3, "0")}`;
    }
    return rawId;
  }

  // 3. Guaranteed friendly identifier e.g. OFFICE-001
  return `${locPrefix}-${paddedNum}`;
}

