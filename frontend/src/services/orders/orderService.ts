import { api } from "../apiClient";

export interface OrderItem {
  id?: string;
  itemId?: string;
  name: string;
  qty: number;
  price: number;
  image?: string;
  preference?: string;
}

export type OrderStatus = "Pending" | "Preparing" | "Ready" | "Delivered" | "Canceled";

export interface ProviderOrder {
  id: string;
  displayId?: string;
  seat: string;
  locationName: string;
  locationId?: string;
  employeeName: string;
  employeeId?: string | null;
  qrToken?: string | null;
  items: OrderItem[];
  subtotal?: number;
  adjustmentAmount?: number;
  discount?: number;
  total: number;
  time: string;
  status: OrderStatus;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface GetOrdersParams {
  location?: string;
  status?: string;
}

export const orderApi = {
  async getOrders(params?: GetOrdersParams): Promise<ProviderOrder[]> {
    const res = await api.get<{ success: boolean; orders: ProviderOrder[] }>("/api/orders", params);
    return res.orders || [];
  },

  async getOrderById(id: string): Promise<ProviderOrder> {
    const res = await api.get<{ success: boolean; order: ProviderOrder }>(`/api/orders/${encodeURIComponent(id)}`);
    return res.order;
  },

  async createOrder(order: Partial<ProviderOrder>): Promise<ProviderOrder> {
    const res = await api.post<{ success: boolean; order: ProviderOrder }>("/api/orders", order);
    return res.order;
  },

  async updateStatus(orderId: string, status: OrderStatus): Promise<ProviderOrder> {
    const res = await api.patch<{ success: boolean; order: ProviderOrder }>(
      `/api/orders/${encodeURIComponent(orderId)}/status`,
      { status }
    );
    return res.order;
  },

  async updateOrder(orderId: string, updates: Partial<ProviderOrder>): Promise<ProviderOrder> {
    const res = await api.put<{ success: boolean; order: ProviderOrder }>(
      `/api/orders/${encodeURIComponent(orderId)}`,
      updates
    );
    return res.order;
  },

  async bulkUpdateStatus(orderIds: string[], status: OrderStatus): Promise<{ success: boolean; updatedCount: number }> {
    return await api.post<{ success: boolean; updatedCount: number }>(
      "/api/orders/bulk-status",
      { orderIds, status }
    );
  },

  async deleteOrder(orderId: string): Promise<void> {
    await api.delete<{ success: boolean }>(`/api/orders/${encodeURIComponent(orderId)}`);
  },
};

export const orderService = orderApi;
export default orderService;
