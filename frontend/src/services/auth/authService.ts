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
  currency?: string;
  currencyCode?: string;
  organizationId?: string;
  mobileNumber?: string;
  userType: "Admin" | "Provider" | "Staff" | string;
  createdAt?: string;
}

export interface UserOrganizationInfo {
  id: string;
  name: string;
  shortCode: string;
  currency?: string;
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
  nationalNumber?: string;
  countryCode?: string;
  dialingCode?: string;
  userType?: "Admin" | "Provider" | "Staff" | string;
  id?: string;
}

export interface MeResponse {
  success: boolean;
  message?: string;
  user?: AuthUser;
  organizations?: UserOrganizationInfo[];
}

export interface CheckAvailabilityResponse {
  success: boolean;
  available: boolean;
  message: string;
}

export const authApi = {
  async checkUsername(username: string, signal?: AbortSignal): Promise<CheckAvailabilityResponse> {
    return api.get<CheckAvailabilityResponse>(
      "/api/auth/check-username",
      { username: username.trim() },
      { signal }
    );
  },

  async checkEmail(email: string, signal?: AbortSignal): Promise<CheckAvailabilityResponse> {
    return api.get<CheckAvailabilityResponse>(
      "/api/auth/check-email",
      { email: email.trim() },
      { signal }
    );
  },

  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    return api.post<LoginResponse>("/api/auth/login", credentials);
  },

  async signup(data: SignupPayload): Promise<LoginResponse> {
    return api.post<LoginResponse>("/api/auth/signup", data);
  },

  async me(): Promise<MeResponse> {
    return api.get<MeResponse>("/api/auth/me");
  },

  async logout(): Promise<void> {
    try {
      await api.post("/api/auth/logout", {});
    } catch {
      // Ignore network errors during logout
    }
  },
};

export const authService = {
  ...authApi,
  async logout(): Promise<void> {
    await authApi.logout();
    localStorage.removeItem("cafe4x_token");
    localStorage.removeItem("cafe4x_currentUser");
    localStorage.removeItem("cafe4x_userOrganizations");
    localStorage.removeItem("cafe4x_organizations");
  },
};

export default authService;
