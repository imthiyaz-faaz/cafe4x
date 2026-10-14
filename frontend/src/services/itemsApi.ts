import { apiFetch } from "./apiClient";

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  image: string;
  status: "Active" | "Out of Stock";
  preferences?: string;
  amount: number;
  type: "Beverages" | "Snacks";
  category: string;
  isLiked?: boolean;
}

export const itemsApi = {
  async getItems(): Promise<MenuItem[]> {
    const res = await apiFetch<{ success: boolean; items: MenuItem[] }>("/api/items");
    return res.items || [];
  },

  async createItem(item: Partial<MenuItem>): Promise<MenuItem> {
    const res = await apiFetch<{ success: boolean; item: MenuItem }>("/api/items", {
      method: "POST",
      body: JSON.stringify(item),
    });
    return res.item;
  },

  async updateItem(id: string, updates: Partial<MenuItem>): Promise<MenuItem> {
    const res = await apiFetch<{ success: boolean; item: MenuItem }>(`/api/items/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });
    return res.item;
  },

  async deleteItem(id: string): Promise<void> {
    await apiFetch<{ success: boolean }>(`/api/items/${id}`, {
      method: "DELETE",
    });
  },

  async toggleLike(id: string): Promise<boolean> {
    const res = await apiFetch<{ success: boolean; isLiked: boolean }>(`/api/items/${id}/like`, {
      method: "POST",
    });
    return res.isLiked;
  },
};
