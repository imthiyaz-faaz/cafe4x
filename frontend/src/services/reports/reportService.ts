import { api } from "../apiClient";
import type { ProviderOrder } from "../orders/orderService";

export interface ReportKPIs {
  totalOrders: number;
  totalRevenue: number;
  deliveredOrders: number;
  pendingOrders: number;
  canceledOrders: number;
  avgOrderValue: number;
  totalItemsSold: number;
  uniqueEmployees: number;
}

export interface ItemReportStat {
  itemId?: string;
  name: string;
  category?: string;
  quantitySold: number;
  totalRevenue: number;
  ordersCount: number;
}

export interface EmployeeReportStat {
  employeeId?: string | null;
  employeeName: string;
  employeeEmail?: string | null;
  department?: string;
  ordersCount: number;
  totalSpend: number;
  lastOrderTime?: string;
}

export interface LocationReportStat {
  locationId?: string;
  locationName: string;
  ordersCount: number;
  totalSpend: number;
}

export interface ReportFilterParams {
  startDate?: string;
  endDate?: string;
  location?: string;
  status?: string;
  period?: "morning" | "evening" | "all";
}

export const reportApi = {
  /**
   * Fetch orders for reporting with active filters
   */
  async getReportOrders(params?: {
    startDate?: string;
    endDate?: string;
    location?: string;
    status?: string;
  }): Promise<ProviderOrder[]> {
    const res = await api.get<{ success: boolean; orders: ProviderOrder[] }>("/api/orders", params);
    return res.orders || [];
  },
};

export default reportApi;
