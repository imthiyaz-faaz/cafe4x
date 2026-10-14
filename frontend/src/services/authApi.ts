const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8787";

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
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(credentials),
    });

    const text = await response.text();
    let data: any = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { message: text || "Unexpected server response" };
    }

    if (!response.ok) {
      throw new Error(data.message || `Request failed with status ${response.status}`);
    }
    return data;
  },
};
