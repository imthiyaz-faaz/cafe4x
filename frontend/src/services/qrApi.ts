import { api } from "./apiClient";

export interface QrSessionResponse {
  success: boolean;
  tempToken?: string;
  expiresAt?: string;
  shortCode?: string;
  isAssignedEmployee?: boolean;
  seat?: {
    id: string;
    number: string;
    locationId: string;
    locationName: string;
    employeeName?: string | null;
  };
  message?: string;
}

export interface QrValidateResponse {
  success: boolean;
  sessionId?: string;
  expiresAt?: string;
  expired?: boolean;
  revoked?: boolean;
  message?: string;
  employee?: {
    id: string;
    displayId?: string;
    name: string;
    email: string;
  } | null;
  seat?: {
    id?: string | null;
    number?: string | null;
    locationId?: string | null;
    locationName?: string | null;
  };
  organization?: {
    id: string;
    shortCode: string;
    name: string;
  };
}

export interface QrProvisionResponse {
  success: boolean;
  permanentToken?: string;
  permTokenStatus?: string;
  message?: string;
  user?: any;
}

/**
 * qrApi – client-side service for the two-tier QR session system.
 *
 * Security notes:
 *  - createSession: sends permanentToken to backend, gets back a tempToken.
 *    The permanentToken is passed once from the URL; it is NOT stored in localStorage.
 *  - createSeatSession: sends locationId and seatNumber to backend, gets back a tempToken.
 *    Resolves assigned employee or creates seat-level session.
 *  - validateSession: sends tempToken (from URL) to backend for server-side validation.
 *  - provisionPermanentToken / revokePermanentToken: admin-only, requires auth headers.
 */
export const qrApi = {
  /**
   * Exchange a permanent QR token for a temporary ordering session.
   * Called by QrEntryPage when the employee scans their permanent QR link.
   */
  async createSession(permanentToken: string): Promise<QrSessionResponse> {
    const res = await api.post<QrSessionResponse>("/api/qr/session", { permanentToken });
    return res;
  },

  /**
   * Create a temporary ordering session from locationId and seatNumber.
   * Called when opening /order/:locationId/:seatNumber.
   */
  async createSeatSession(params: {
    shortCode?: string;
    locationId: string;
    seatNumber: string;
    seatId?: string;
  }): Promise<QrSessionResponse> {
    const res = await api.post<QrSessionResponse>("/api/qr/seat-session", params);
    return res;
  },

  /**
   * Validate a temporary ordering session token.
   * Called by UserOrderPage on mount to check if the session is still valid.
   */
  async validateSession(tempToken: string): Promise<QrValidateResponse> {
    return await api.get<QrValidateResponse>(`/api/qr/validate/${encodeURIComponent(tempToken)}`);
  },

  /**
   * Provision or re-provision a permanent QR credential for an employee (admin only).
   * Returns the raw permanentToken ONCE for QR code generation.
   */
  async provisionPermanentToken(userId: string): Promise<QrProvisionResponse> {
    return await api.post<QrProvisionResponse>(`/api/qr/provision/${userId}`, {});
  },

  /**
   * Revoke a permanent QR credential for an employee (admin only).
   */
  async revokePermanentToken(userId: string): Promise<{ success: boolean; message: string }> {
    return await api.post<{ success: boolean; message: string }>(
      `/api/qr/revoke/${userId}`,
      {}
    );
  },

  /**
   * Revoke a specific ordering session (admin only).
   */
  async revokeSession(sessionId: string): Promise<{ success: boolean; message: string }> {
    return await api.post<{ success: boolean; message: string }>(
      `/api/qr/session/${sessionId}/revoke`,
      {}
    );
  },

  /**
   * List recent ordering sessions for the admin's organization.
   */
  async listSessions(): Promise<{ success: boolean; sessions: any[] }> {
    return await api.get<{ success: boolean; sessions: any[] }>("/api/qr/sessions");
  },
};

export default qrApi;
