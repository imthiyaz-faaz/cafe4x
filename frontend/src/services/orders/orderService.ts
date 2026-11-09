import { api } from "../apiClient";

export interface OrderItem {
  id?: string;
  itemId?: string;
  name: string;
  qty: number;
  price: number;
  image?: string;
  preference?: string;
  type?: string;
  category?: string;
}

export type OrderStatus = "Pending" | "Preparing" | "Ready" | "Delivered" | "Canceled";

export interface ProviderOrder {
  id: string;
  displayId?: string;
  seat: string;
  seatId?: string;
  locationName: string;
  locationId?: string;
  employeeName: string;
  employeeId?: string | null;
  qrToken?: string | null;
  tempSessionToken?: string | null;
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
  employee?: string;
  startDate?: string;
  endDate?: string;
}

export interface EmployeeOrderSummary {
  employeeId: string | null;
  employeeName: string;
  employeeEmail: string | null;
  department: string;
  locationName: string;
  seat: string;
  orderCount: number;
  totalSpend: number;
  latestOrderDate: string;
}

export interface LocationOrderSummary {
  id: string;
  name: string;
  locationType: string;
  totalSeats: number;
  totalEmployees: number;
  totalOrders: number;
  totalAmount: number;
  pendingOrders: number;
  deliveredOrders: number;
  status: string;
}

export interface LocationEmployeeOrderSummary {
  employeeId: string;
  employeeName: string;
  username?: string;
  employeeEmail?: string;
  seat: string;
  seatId?: string;
  totalOrders: number;
  totalAmount: number;
  latestStatus?: string;
  latestOrderDate?: string;
}

export interface EmployeeOrderDetailProfile {
  id: string;
  name: string;
  username?: string;
  email?: string;
  locationName: string;
  seatIdentifier: string;
  totalOrders: number;
  totalSpend: number;
  pendingOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
}

export interface EmployeeOrdersResponse {
  success: boolean;
  employee: EmployeeOrderDetailProfile;
  orders: ProviderOrder[];
}

export const orderApi = {
  async getOrders(params?: GetOrdersParams, options?: { signal?: AbortSignal }): Promise<ProviderOrder[]> {
    const res = await api.get<{ success: boolean; orders: ProviderOrder[] }>("/api/orders", params, { signal: options?.signal });
    return res.orders || [];
  },

  async getOrderLocations(params?: { startDate?: string; endDate?: string }, options?: { signal?: AbortSignal }): Promise<LocationOrderSummary[]> {
    const res = await api.get<{ success: boolean; locations: LocationOrderSummary[] }>("/api/orders/locations", params, { signal: options?.signal });
    return res.locations || [];
  },

  async getLocationEmployees(locationId: string, params?: { startDate?: string; endDate?: string }, options?: { signal?: AbortSignal }): Promise<{ location: { id: string; name: string }; employees: LocationEmployeeOrderSummary[] }> {
    const res = await api.get<{ success: boolean; location: { id: string; name: string }; employees: LocationEmployeeOrderSummary[] }>(
      `/api/orders/location/${encodeURIComponent(locationId)}/employees`,
      params,
      { signal: options?.signal }
    );
    return { location: res.location, employees: res.employees || [] };
  },

  async getEmployeeOrders(employeeId: string, params?: { startDate?: string; endDate?: string }, options?: { signal?: AbortSignal }): Promise<EmployeeOrdersResponse> {
    const res = await api.get<EmployeeOrdersResponse>(
      `/api/orders/employee/${encodeURIComponent(employeeId)}`,
      params,
      { signal: options?.signal }
    );
    return res;
  },

  async getOrderEmployees(params?: { startDate?: string; endDate?: string }, options?: { signal?: AbortSignal }): Promise<EmployeeOrderSummary[]> {
    const res = await api.get<{ success: boolean; employees: EmployeeOrderSummary[] }>("/api/orders/employees", params, { signal: options?.signal });
    return res.employees || [];
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
