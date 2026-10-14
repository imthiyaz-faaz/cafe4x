import { apiFetch } from "./apiClient";

export interface UserItem {
  id: string;
  name: string;
  userName: string;
  password?: string;
  userType: string;
  email: string;
  mobileNumber?: string;
}

export const userApi = {
  async getUsers(type?: string): Promise<UserItem[]> {
    const query = type ? `?type=${encodeURIComponent(type)}` : "";
    const res = await apiFetch<{ success: boolean; users: UserItem[] }>(`/api/users${query}`);
    return res.users || [];
  },

  async createUser(user: Partial<UserItem>): Promise<UserItem> {
    const res = await apiFetch<{ success: boolean; user: UserItem }>("/api/users", {
      method: "POST",
      body: JSON.stringify(user),
    });
    return res.user;
  },

  async updateUser(id: string, updates: Partial<UserItem>): Promise<UserItem> {
    const res = await apiFetch<{ success: boolean; user: UserItem }>(`/api/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });
    return res.user;
  },

  async deleteUser(id: string): Promise<void> {
    await apiFetch<{ success: boolean }>(`/api/users/${id}`, {
      method: "DELETE",
    });
  },
};
