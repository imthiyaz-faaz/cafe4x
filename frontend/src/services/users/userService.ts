import { api } from "../apiClient";

export interface UserItem {
  id: string;
  name: string;
  userName: string;
  password?: string;
  userType: "Admin" | "Provider" | "Staff" | string;
  email: string;
  mobileNumber?: string;
  organization?: string;
  shortCode?: string;
  organizationId?: string;
  createdAt?: string;
}

export interface GetUsersParams {
  type?: string;
  shortCode?: string;
  organization?: string;
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
};

export const userService = userApi;
export default userService;
