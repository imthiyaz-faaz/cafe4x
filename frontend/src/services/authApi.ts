import { apiFetch } from "./apiClient";

export interface LoginCredentials {
  usernameOrEmail: string;
  password?: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  token?: string;
  user?: {
    id?: string;
    email: string;
    userName?: string;
    name?: string;
    userType: "Admin" | "Provider" | "Staff";
  };
}

export const authApi = {
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    return apiFetch<LoginResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    });
  },

  async signup(data: any): Promise<LoginResponse> {
    return apiFetch<LoginResponse>("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async me(): Promise<{ success: boolean; user?: any }> {
    return apiFetch<{ success: boolean; user?: any }>("/api/auth/me");
  },
};
