import { api } from "../apiClient";

export interface MenuItem {
  id: string;
  displayId?: string;
  name: string;
  description: string;
  image: string;
  status: "Active" | "Out of Stock";
  preference?: string;
  preferences?: string;
  amount: number;
  type: "Beverages" | "Snacks";
  category: string;
  isLiked?: boolean;
  shortCode?: string;
  organizationId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface GetItemsParams {
  shortCode?: string;
  organizationId?: string;
  type?: string;
}

export const itemsApi = {
  async getItems(
    paramsOrShortCode?: GetItemsParams | string,
    organizationId?: string,
    type?: string
  ): Promise<MenuItem[]> {
    let params: Record<string, any> = {};

    if (typeof paramsOrShortCode === "string") {
      if (paramsOrShortCode) params.shortCode = paramsOrShortCode;
      if (organizationId) params.organizationId = organizationId;
      if (type && type !== "All") params.type = type;
    } else if (paramsOrShortCode) {
      params = { ...paramsOrShortCode };
      if (params.type === "All") delete params.type;
    }

    const res = await api.get<{ success: boolean; items: MenuItem[] }>("/api/items", params);
    return res.items || [];
  },

  async getItemById(id: string): Promise<MenuItem> {
    const res = await api.get<{ success: boolean; item: MenuItem }>(`/api/items/${id}`);
    return res.item;
  },

  async createItem(item: Partial<MenuItem>): Promise<MenuItem> {
    const res = await api.post<{ success: boolean; item: MenuItem }>("/api/items", item);
    return res.item;
  },

  async updateItem(id: string, updates: Partial<MenuItem>): Promise<MenuItem> {
    const res = await api.put<{ success: boolean; item: MenuItem }>(`/api/items/${id}`, updates);
    return res.item;
  },

  async deleteItem(id: string): Promise<void> {
    await api.delete<{ success: boolean }>(`/api/items/${id}`);
  },

  async toggleLike(id: string): Promise<boolean> {
    const res = await api.post<{ success: boolean; isLiked: boolean }>(`/api/items/${id}/like`);
    return Boolean(res.isLiked);
  },
};

export const itemService = itemsApi;
export default itemService;
