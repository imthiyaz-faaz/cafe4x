import { api } from "../apiClient";

export interface LoginCredentials {
  usernameOrEmail?: string;
  username?: string;
  email?: string;
  password?: string;
}

export interface AuthUser {
  id?: string;
  email: string;
  userName?: string;
  name?: string;
  organization?: string;
  shortCode?: string;
  organizationId?: string;
  mobileNumber?: string;
  userType: "Admin" | "Provider" | "Staff" | string;
  createdAt?: string;
}

export interface UserOrganizationInfo {
  id: string;
  name: string;
  shortCode: string;
  ownerUserId?: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  token?: string;
  user?: AuthUser;
  organizations?: UserOrganizationInfo[];
}

export interface SignupPayload {
  name?: string;
  userName?: string;
  email: string;
  password?: string;
  organization?: string;
  shortCode?: string;
  mobileNumber?: string;
  userType?: "Admin" | "Provider" | "Staff" | string;
  id?: string;
}

export interface MeResponse {
  success: boolean;
  message?: string;
  user?: AuthUser;
  organizations?: UserOrganizationInfo[];
}

export const authApi = {
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    return api.post<LoginResponse>("/api/auth/login", credentials);
  },

  async signup(data: SignupPayload): Promise<LoginResponse> {
    return api.post<LoginResponse>("/api/auth/signup", data);
  },

  async me(): Promise<MeResponse> {
    return api.get<MeResponse>("/api/auth/me");
  },

  async logout(tokenToRevoke?: string): Promise<void> {
    try {
      const headers: Record<string, string> = {};
      if (tokenToRevoke) {
        headers["Authorization"] = `Bearer ${tokenToRevoke}`;
      }
      await api.post("/api/auth/logout", {}, { headers });
    } catch {
      // Ignore network errors during logout
    }
  },
};

export const authService = {
  ...authApi,
  async logout(tokenToRevoke?: string): Promise<void> {
    await authApi.logout(tokenToRevoke);
    localStorage.removeItem("cafe4x_token");
    localStorage.removeItem("cafe4x_currentUser");
    localStorage.removeItem("cafe4x_userOrganizations");
    localStorage.removeItem("cafe4x_organizations");
  },
};

export default authService;
