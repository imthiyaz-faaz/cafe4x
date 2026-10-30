/**
 * Formats any raw order ID or display ID into a clean sequential format for Provider Workspace:
 * e.g.
 * "ORD-0001" -> "ORD-0001"
 * "#ORD-8510" -> "ORD-8510"
 * "ORD-FTS-2026-000001" -> "ORD-0001"
 * "1" -> "ORD-0001"
 */
export function formatProviderOrderId(order: { id: string; displayId?: string } | string): string {
  const raw = typeof order === "string" ? order : (order.displayId || order.id || "");
  const trimmed = raw.trim();

  // If already matches exact ORD-XXXX pattern (e.g. ORD-0001, ORD-8510)
  if (/^ORD-\d{4,}$/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  // If starts with #ORD-
  if (/^#ORD-(\d+)$/i.test(trimmed)) {
    const match = trimmed.match(/^#ORD-(\d+)$/i);
    if (match && match[1]) {
      return `ORD-${match[1].padStart(4, "0")}`;
    }
  }

  // If it's a long display ID like ORD-FTS-2026-000001, extract ending numeric portion
  const endNumMatch = trimmed.match(/(\d+)$/);
  if (endNumMatch && endNumMatch[1]) {
    const num = parseInt(endNumMatch[1], 10);
    return `ORD-${String(num).padStart(4, "0")}`;
  }

  return trimmed || "ORD-0001";
}

