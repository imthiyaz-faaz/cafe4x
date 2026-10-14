import { apiFetch } from "./apiClient";

export interface OrderItem {
  name: string;
  qty: number;
  price: number;
}

export interface ProviderOrder {
  id: string;
  seat: string;
  locationName: string;
  locationId?: string;
  employeeName: string;
  items: OrderItem[];
  total: number;
  time: string;
  status: "Pending" | "Preparing" | "Ready" | "Delivered" | "Canceled";
  notes?: string;
}

export const orderApi = {
  async getOrders(params?: { location?: string; status?: string }): Promise<ProviderOrder[]> {
    const searchParams = new URLSearchParams();
    if (params?.location) searchParams.append("location", params.location);
    if (params?.status) searchParams.append("status", params.status);
    const qs = searchParams.toString();
    const endpoint = `/api/orders${qs ? `?${qs}` : ""}`;

    const res = await apiFetch<{ success: boolean; orders: ProviderOrder[] }>(endpoint);
    return res.orders || [];
  },

  async createOrder(order: Partial<ProviderOrder>): Promise<ProviderOrder> {
    const res = await apiFetch<{ success: boolean; order: ProviderOrder }>("/api/orders", {
      method: "POST",
      body: JSON.stringify(order),
    });
    return res.order;
  },

  async updateStatus(orderId: string, status: ProviderOrder["status"]): Promise<ProviderOrder> {
    const res = await apiFetch<{ success: boolean; order: ProviderOrder }>(
      `/api/orders/${encodeURIComponent(orderId)}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }
    );
    return res.order;
  },
};
