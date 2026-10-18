import { api } from "../apiClient";

export interface UserItem {
  id: string;
  displayId?: string;
  name: string;
  userName: string;
  password?: string;
  userType: "Admin" | "Provider" | "Staff" | string;
  email: string;
  mobileNumber?: string;
  organization?: string;
  shortCode?: string;
  organizationId?: string;
  qrToken?: string | null;
  qrTokenCreatedAt?: string | null;
  qrTokenStatus?: string;
  createdAt?: string;
}

export interface GetUsersParams {
  type?: string;
  shortCode?: string;
  organization?: string;
}

export interface ValidatedQrTokenResponse {
  success: boolean;
  message?: string;
  employee: {
    id: string;
    displayId?: string;
    name: string;
    email: string;
  };
  organization: {
    id: string;
    shortCode: string;
    name: string;
  };
}

export const userApi = {
  async getUsers(paramsOrType?: GetUsersParams | string, shortCode?: string): Promise<UserItem[]> {
    let params: Record<string, any> = {};

    if (typeof paramsOrType === "string") {
      if (paramsOrType) params.type = paramsOrType;
      if (shortCode) params.shortCode = shortCode;
    } else if (paramsOrType) {
      params = { ...paramsOrType };
    }

    const res = await api.get<{ success: boolean; users: UserItem[] }>("/api/users", params);
    return res.users || [];
  },

  async getUserById(id: string): Promise<UserItem> {
    const res = await api.get<{ success: boolean; user: UserItem }>(`/api/users/${id}`);
    return res.user;
  },

  async createUser(user: Partial<UserItem>): Promise<UserItem> {
    const res = await api.post<{ success: boolean; user: UserItem }>("/api/users", user);
    return res.user;
  },

  async updateUser(id: string, updates: Partial<UserItem>): Promise<UserItem> {
    const res = await api.put<{ success: boolean; user: UserItem }>(`/api/users/${id}`, updates);
    return res.user;
  },

  async deleteUser(id: string): Promise<void> {
    await api.delete<{ success: boolean }>(`/api/users/${id}`);
  },

  async validateQrToken(token: string): Promise<ValidatedQrTokenResponse> {
    return await api.get<ValidatedQrTokenResponse>(`/api/users/qr-token/${token}`);
  },

  async regenerateQrToken(userId: string): Promise<{ success: boolean; qrToken: string; qrTokenStatus: string; user?: any }> {
    return await api.post<{ success: boolean; qrToken: string; qrTokenStatus: string; user?: any }>(`/api/users/${userId}/qr-token/regenerate`, {});
  },

  async revokeQrToken(userId: string): Promise<{ success: boolean; message: string; qrTokenStatus: string }> {
    return await api.post<{ success: boolean; message: string; qrTokenStatus: string }>(`/api/users/${userId}/qr-token/revoke`, {});
  },
};

export const userService = userApi;
export default userService;
