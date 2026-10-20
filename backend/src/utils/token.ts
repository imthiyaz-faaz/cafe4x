import { sign, verify } from "hono/jwt";

export interface TempOrderingTokenPayload {
  // Subject: session identifier
  sub: string;
  // Organization ID the ordering session belongs to
  orgId: string;
  // Short code (e.g. FTS)
  orgCode: string;
  // Verified employee ID (if assigned) or null for guest seat ordering
  empId?: string | null;
  // Verified location ID
  locId?: string | null;
  // Verified seat number (padded string e.g. "01")
  seatNo?: string | null;
  // Verified seat ID (e.g. "FTS-01")
  seatId?: string | null;
  // Issued at (seconds)
  iat: number;
  // Expiration time (seconds)
  exp: number;
  // Token type marker
  typ: "temp_order_token";
}

/** Default secret used only in offline local development if no Worker secret or env is set */
const DEFAULT_DEV_SECRET = "cafe4x_local_dev_stateless_secret_change_in_production_min32chars";

/**
 * Resolves the signing secret safely from Worker environment bindings or process.env
 */
export function getSigningSecret(env?: { JWT_SECRET?: string }): string {
  if (env?.JWT_SECRET && typeof env.JWT_SECRET === "string" && env.JWT_SECRET.trim().length > 0) {
    return env.JWT_SECRET.trim();
  }
  const procEnv = (globalThis as any).process?.env?.JWT_SECRET;
  if (procEnv && typeof procEnv === "string" && procEnv.trim().length > 0) {
    return procEnv.trim();
  }
  return DEFAULT_DEV_SECRET;
}

/**
 * Creates a cryptographically signed, stateless temporary JWT token for employee ordering.
 *
 * @param claims Information to include in the token payload (org, session, seat/employee)
 * @param secret Signing secret from Worker environment
 * @param durationSeconds Expiration duration in seconds (defaults to 1800 = 30 minutes)
 */
export async function createTemporaryOrderToken(
  claims: {
    sessionId: string;
    organizationId: string;
    shortCode: string;
    employeeId?: string | null;
    locationId?: string | null;
    seatNumber?: string | null;
    seatId?: string | null;
  },
  secret: string,
  durationSeconds: number = 30 * 60
): Promise<string> {
  const nowSec = Math.floor(Date.now() / 1000);
  const expSec = nowSec + durationSeconds;

  const payload: TempOrderingTokenPayload = {
    sub: claims.sessionId,
    orgId: String(claims.organizationId),
    orgCode: claims.shortCode.toUpperCase(),
    empId: claims.employeeId ? String(claims.employeeId) : null,
    locId: claims.locationId ? String(claims.locationId) : null,
    seatNo: claims.seatNumber ? String(claims.seatNumber).padStart(2, "0") : null,
    seatId: claims.seatId ? String(claims.seatId) : null,
    iat: nowSec,
    exp: expSec,
    typ: "temp_order_token",
  };

  return await sign(payload as any, secret, "HS256");
}

export type TokenVerificationResult =
  | { valid: true; payload: TempOrderingTokenPayload }
  | { valid: false; reason: "expired" | "malformed" | "invalid_signature" | "invalid_type"; error?: string };

/**
 * Verifies a temporary ordering token using the secret and validates the payload structure.
 */
export async function verifyTemporaryOrderToken(
  token: string,
  secret: string
): Promise<TokenVerificationResult> {
  try {
    const rawPayload = (await verify(token, secret, "HS256")) as any;

    if (!rawPayload || typeof rawPayload !== "object") {
      return { valid: false, reason: "malformed" };
    }

    if (rawPayload.typ !== "temp_order_token") {
      return { valid: false, reason: "invalid_type" };
    }

    if (!rawPayload.orgId || !rawPayload.sub) {
      return { valid: false, reason: "malformed" };
    }

    const nowSec = Math.floor(Date.now() / 1000);
    if (typeof rawPayload.exp === "number" && rawPayload.exp < nowSec) {
      return { valid: false, reason: "expired" };
    }

    return { valid: true, payload: rawPayload as TempOrderingTokenPayload };
  } catch (err: any) {
    const msg = (err?.message || "").toLowerCase();
    if (msg.includes("expired") || msg.includes("exp")) {
      return { valid: false, reason: "expired", error: err.message };
    }
    return { valid: false, reason: "invalid_signature", error: err.message };
  }
}
