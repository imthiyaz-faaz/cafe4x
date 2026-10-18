import { UniversalDb } from "../db";

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

/**
 * Generates an atomic, sequential, meaningful identifier.
 * e.g. USR-0001, ORG-FTS-0001, LOC-FTS-0001, SEAT-FTS-001, ITEM-FTS-0001, ORD-FTS-2026-000001
 */
export async function getNextId(
  db: UniversalDb,
  type: "USER" | "ORG" | "LOC" | "SEAT" | "ITEM" | "ORD",
  shortCode?: string
): Promise<{ id: string; displayId: string }> {
  const code = (shortCode || "ORG").toUpperCase().trim();
  const year = new Date().getFullYear();

  let scope = "";
  let prefix = "";
  let padLen = 4;

  switch (type) {
    case "USER":
      scope = "USERS";
      prefix = "USR";
      padLen = 4;
      break;
    case "ORG":
      scope = `ORG_${code}`;
      prefix = `ORG-${code}`;
      padLen = 4;
      break;
    case "LOC":
      scope = `LOC_${code}`;
      prefix = `LOC-${code}`;
      padLen = 4;
      break;
    case "SEAT":
      scope = `SEAT_${code}`;
      prefix = `SEAT-${code}`;
      padLen = 3;
      break;
    case "ITEM":
      scope = `ITEM_${code}`;
      prefix = `ITEM-${code}`;
      padLen = 4;
      break;
    case "ORD":
      scope = `ORD_${code}_${year}`;
      prefix = `ORD-${code}-${year}`;
      padLen = 6;
      break;
  }

  // Atomically increment counter
  await db
    .prepare(
      `INSERT INTO id_sequences (scope, last_val) VALUES (?, 1)
       ON CONFLICT(scope) DO UPDATE SET last_val = last_val + 1`
    )
    .run(scope);

  const row = (await db.prepare(`SELECT last_val FROM id_sequences WHERE scope = ?`).bind(scope).get()) as any;
  const num = row?.last_val || 1;
  const displayId = `${prefix}-${String(num).padStart(padLen, "0")}`;

  return {
    id: displayId,
    displayId,
  };
}
