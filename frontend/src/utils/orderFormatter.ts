/**
 * Utilities for formatting order IDs for clean presentation across Cafe4X frontend.
 * Retains original database and API identifiers (e.g. "ORD-000001", "ord_xyz", UUIDs)
 * for network requests and backend state, while stripping unnecessary leading zeros
 * from the numeric portion to render clean, friendly display IDs (e.g. "ORD-1", "ORD-25", "ORD-100").
 */

export interface OrderLike {
  id?: string | null;
  displayId?: string | null;
  orderId?: string | null;
}

/**
 * Strips unnecessary leading zeros from an order ID while preserving the "ORD-" prefix.
 *
 * Examples:
 * - "ORD-000001" -> "ORD-1"
 * - "ORD-000006" -> "ORD-6"
 * - "ORD-000009" -> "ORD-9"
 * - "ORD-000025" -> "ORD-25"
 * - "ORD-000100" -> "ORD-100"
 * - "#ORD-0005"  -> "ORD-5"
 * - "ORD-1"      -> "ORD-1"
 * - "25"         -> "ORD-25"
 *
 * Safely returns the original string (or fallback) if it's invalid or non-numeric.
 */
export function formatOrderId(
  order?: OrderLike | string | null | undefined,
  fallback: string = ""
): string {
  if (order === null || order === undefined) {
    return fallback;
  }

  const raw =
    typeof order === "string"
      ? order
      : order.displayId || order.id || order.orderId || "";

  const trimmed = String(raw).trim();
  if (!trimmed) {
    return fallback;
  }

  // Handle #ORD-000123 or ORD-000123 or ORD-123 (case-insensitive)
  const ordMatch = trimmed.match(/^#?ORD-0*(\d+)$/i);
  if (ordMatch && ordMatch[1]) {
    const num = parseInt(ordMatch[1], 10);
    return `ORD-${!isNaN(num) ? num : ordMatch[1]}`;
  }

  // Handle composite IDs ending with numbers, e.g. ORD-FTS-2026-000025
  const compositeMatch = trimmed.match(/^#?ORD-.*-0*(\d+)$/i);
  if (compositeMatch && compositeMatch[1]) {
    const num = parseInt(compositeMatch[1], 10);
    return `ORD-${!isNaN(num) ? num : compositeMatch[1]}`;
  }

  // Handle plain numbers, e.g. "1", "0025"
  const pureNumMatch = trimmed.match(/^0*(\d+)$/);
  if (pureNumMatch && pureNumMatch[1]) {
    const num = parseInt(pureNumMatch[1], 10);
    return `ORD-${!isNaN(num) ? num : pureNumMatch[1]}`;
  }

  return trimmed;
}

/**
 * Backwards compatibility alias for provider components.
 */
export const formatProviderOrderId = formatOrderId;

