import { UniversalDb } from "../db";

/**
 * Hash a raw string using SHA-256 hex encoding.
 * Compatible with Cloudflare Workers runtime and Node.js.
 */
export async function sha256Hex(raw: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(raw));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Hash password securely using Web Crypto API (SHA-256 with salt)
 * Compatible with Cloudflare Workers runtime and Node.js
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  const enc = new TextEncoder();
  const data = enc.encode(`${salt}:${password}`);
  const hashBuf = await crypto.subtle.digest("SHA-256", data);
  const hashArr = Array.from(new Uint8Array(hashBuf));
  const hexHash = hashArr.map((b) => b.toString(16).padStart(2, "0")).join("");
  return `pbkdf2_sha256$${salt}$${hexHash}`;
}

/**
 * Generate cryptographically secure random alphanumeric token (base62)
 * Compatible with Cloudflare Workers runtime and Node.js
 * Generates 16-character token (e.g. nZ2LAjF1adPBSrmY)
 */
export function generateSecureQrToken(length: number = 16): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

/**
 * Generates a permanent, cryptographically unpredictable token for a seat's ordering QR code.
 * Example: "seat_7f8c12a4b3d9e01f"
 */
export function generateSeatQrToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let token = "";
  for (let i = 0; i < bytes.length; i++) {
    token += chars[bytes[i] % chars.length];
  }
  return `seat_${token}`;
}

/**
 * Verify password against stored hash or fallback to legacy plaintext
 */
export async function verifyPassword(password: string, storedHashOrPlain: string): Promise<boolean> {
  if (!storedHashOrPlain) return false;

  // If stored in hashed format: pbkdf2_sha256$<salt>$<hash>
  if (storedHashOrPlain.startsWith("pbkdf2_sha256$")) {
    const parts = storedHashOrPlain.split("$");
    if (parts.length === 3) {
      const salt = parts[1];
      const expectedHash = parts[2];
      const enc = new TextEncoder();
      const data = enc.encode(`${salt}:${password}`);
      const hashBuf = await crypto.subtle.digest("SHA-256", data);
      const hashArr = Array.from(new Uint8Array(hashBuf));
      const hexHash = hashArr.map((b) => b.toString(16).padStart(2, "0")).join("");
      return hexHash === expectedHash;
    }
  }

  // Fallback to legacy plaintext comparison
  return password === storedHashOrPlain;
}

export type EntityIdType =
  | "ORG"
  | "USR"
  | "UOR"
  | "LOC"
  | "PRL"
  | "ITM"
  | "SEA"
  | "ORD"
  | "OIT"
  | "SES"
  | "OSN"
  | "WHR"
  | "ESA";

const ENTITY_CONFIG: Record<EntityIdType, { scope: string; prefix: string; padLen: number }> = {
  ORG: { scope: "ORGANIZATIONS", prefix: "ORG", padLen: 6 },
  USR: { scope: "USERS", prefix: "USR", padLen: 6 },
  UOR: { scope: "USER_ORGANIZATIONS", prefix: "UOR", padLen: 6 },
  LOC: { scope: "LOCATIONS", prefix: "LOC", padLen: 6 },
  PRL: { scope: "PROVIDER_LOCATIONS", prefix: "PRL", padLen: 6 },
  ITM: { scope: "ITEMS", prefix: "ITM", padLen: 6 },
  SEA: { scope: "SEATS", prefix: "SEA", padLen: 6 },
  ORD: { scope: "ORDERS", prefix: "ORD", padLen: 6 },
  OIT: { scope: "ORDER_ITEMS", prefix: "OIT", padLen: 6 },
  SES: { scope: "USER_SESSIONS", prefix: "SES", padLen: 6 },
  OSN: { scope: "ORDERING_SESSIONS", prefix: "OSN", padLen: 6 },
  WHR: { scope: "WORKING_HOURS", prefix: "WHR", padLen: 6 },
  ESA: { scope: "EMPLOYEE_SEAT_ASSIGNMENTS", prefix: "ESA", padLen: 6 },
};

/**
 * Generates an atomic, sequential, standardized 6-digit identifier:
 * ORG-000001, USR-000001, UOR-000001, LOC-000001, PRL-000001,
 * ITM-000001, SEA-000001, ORD-000001, OIT-000001, SES-000001, OSN-000001, WHR-000001
 */
export async function generateId(
  db: UniversalDb,
  type: EntityIdType
): Promise<string> {
  const config = ENTITY_CONFIG[type];
  if (!config) {
    throw new Error(`Unsupported entity type: ${type}`);
  }

  // Atomically increment counter in id_sequences
  await db
    .prepare(
      `INSERT INTO id_sequences (scope, last_val) VALUES (?, 1)
       ON CONFLICT(scope) DO UPDATE SET last_val = last_val + 1`
    )
    .run(config.scope);

  const row = (await db.prepare(`SELECT last_val FROM id_sequences WHERE scope = ?`).bind(config.scope).get()) as any;
  const num = row?.last_val || 1;
  return `${config.prefix}-${String(num).padStart(config.padLen, "0")}`;
}

/**
 * Normalizes a location name to an uppercase, hyphen-separated prefix.
 * e.g. "office" -> "OFFICE", "Room" -> "ROOM", "Meeting Room" -> "MEETING-ROOM", "Chennai Branch" -> "CHENNAI-BRANCH"
 */
export function normalizeLocationPrefix(name: string): string {
  const cleaned = (name || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "-")
    .replace(/[^A-Z0-9-]+/g, "")
    .replace(/^-+|-+$/g, "");
  return cleaned || "SEAT";
}

/**
 * Generates an atomic, sequential, location-scoped seat identifier:
 * e.g. OFFICE-0001, ROOM-0001, MEETING-ROOM-0001
 * Uses id_sequences with scope: SEAT_LOC_<locationId>
 */
export async function generateLocationSeatId(
  db: UniversalDb,
  locationId: string,
  locationName: string,
  preferredNumber?: number
): Promise<{ seatId: string; number: string; displayId: string }> {
  const prefix = normalizeLocationPrefix(locationName);

  if (preferredNumber !== undefined && preferredNumber > 0) {
    const candidateId = `${prefix}-${preferredNumber}`;
    const candidateNumber = String(preferredNumber);
    return {
      seatId: candidateId,
      number: candidateNumber,
      displayId: candidateId,
    };
  }

  // Find all existing seat numbers for this location_id directly from the database
  const existingSeats = (await db
    .prepare(`SELECT number, display_id, id FROM seats WHERE location_id = ?`)
    .bind(locationId)
    .all()) as any[];

  let maxNum = 0;
  const usedNumbers = new Set<number>();
  for (const s of existingSeats || []) {
    const p = parseInt(s.number, 10);
    if (!isNaN(p) && p > 0) {
      usedNumbers.add(p);
      maxNum = Math.max(maxNum, p);
    }
    const m = String(s.display_id || s.id || "").match(/(\d+)$/);
    if (m) {
      const idNum = parseInt(m[1], 10);
      if (!isNaN(idNum) && idNum > 0) {
        usedNumbers.add(idNum);
        maxNum = Math.max(maxNum, idNum);
      }
    }
  }

  // Next candidate is highest existing number + 1
  let nextVal = maxNum + 1;
  while (usedNumbers.has(nextVal)) {
    nextVal++;
  }

  const candidateId = `${prefix}-${nextVal}`;
  const candidateNumber = String(nextVal);

  return {
    seatId: candidateId,
    number: candidateNumber,
    displayId: candidateId,
  };
}

/**
 * Backward compatibility wrapper returning both id and displayId as the standardized format.
 */
export async function getNextId(
  db: UniversalDb,
  type: "USER" | "ORG" | "LOC" | "SEAT" | "ITEM" | "ORD",
  _shortCode?: string
): Promise<{ id: string; displayId: string }> {
  let mappedType: EntityIdType = "ORG";
  switch (type) {
    case "USER": mappedType = "USR"; break;
    case "ORG": mappedType = "ORG"; break;
    case "LOC": mappedType = "LOC"; break;
    case "SEAT": mappedType = "SEA"; break;
    case "ITEM": mappedType = "ITM"; break;
    case "ORD": mappedType = "ORD"; break;
  }
  const id = await generateId(db, mappedType);
  return { id, displayId: id };
}
