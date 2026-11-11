import { api } from "./apiClient";

export interface TableItem {
  id: number;
  locationId: number;
  name: string;
  seatLimit: number;
  isActive: number;
  occupiedSeats: number;
  availableSeats: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface SeatItem {
  id: string;
  tableId: number;
  locationId: number;
  number: number;
  status: "available" | "occupied" | "blocked";
  employeeId?: string | null;
  employeeName?: string | null;
  employeeEmail?: string | null;
  employeeUserName?: string | null;
  employeeStatus?: string | null;
  qrToken?: string | null;
  orderUrl?: string | null;
}

export interface TableDetailsData extends TableItem {
  locationName: string;
  occupancyPercentage: number;
  seats: SeatItem[];
}

export interface LocationStatisticsData {
  totalTables: number;
  totalSeats: number;
  occupiedSeats: number;
  availableSeats: number;
  occupancyPercentage: number;
  tableLimit: number;
}

export interface CreateTablePayload {
  name: string;
  seatLimit: number;
  isActive?: boolean;
}

export interface OccupiedEmployeeItem {
  seatId: string;
  seatNumber: number;
  seatIdentifier: string;
  seatStatus: string;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  employeeUserName?: string | null;
  employeeRole?: string;
  tableId: number;
  tableName: string;
  assignmentDate: string;
  qrToken?: string | null;
  orderUrl?: string | null;
}

export interface OccupiedEmployeesResponse {
  success: boolean;
  locationId: number | string;
  locationName: string;
  totalOccupiedEmployees: number;
  totalTablesRepresented: number;
  page: number;
  limit: number;
  totalPages: number;
  employees: OccupiedEmployeeItem[];
}

export interface EmployeeSeatProfileDetails {
  seatId: string;
  tableId: number;
  tableName: string;
  locationId: number;
  locationName: string;
  organizationId: string;
  organizationName?: string;
  shortCode: string;
  seatNumber: number;
  seatIdentifier: string;
  seatStatus: string;
  employeeId?: string | null;
  employeeName?: string | null;
  employeeEmail?: string | null;
  employeeUserName?: string | null;
  employeeRole?: string;
  assignmentDate: string;
  qrToken?: string | null;
  orderUrl?: string | null;
  orderStats: {
    totalOrders: number;
    totalAmount: number;
    pendingOrders: number;
    deliveredOrders: number;
    cancelledOrders: number;
  };
  recentOrders: Array<{
    id: string;
    displayId: string;
    total: number;
    status: string;
    time: string;
    createdAt: string;
    items: any[];
  }>;
}

export const tableService = {
  // Get tables for a location
  async getTablesByLocation(locationId: string | number): Promise<{ tables: TableItem[]; tableLimit: number }> {
    const res = await api.get<{ success: boolean; tables: TableItem[]; tableLimit: number }>(
      `/api/locations/${locationId}/tables`
    );
    return {
      tables: res?.tables || [],
      tableLimit: res?.tableLimit || 5,
    };
  },

  // Get location statistics
  async getLocationStatistics(locationId: string | number): Promise<LocationStatisticsData> {
    const res = await api.get<{ success: boolean; statistics: LocationStatisticsData }>(
      `/api/locations/${locationId}/statistics`
    );
    return res?.statistics || {
      totalTables: 0,
      totalSeats: 0,
      occupiedSeats: 0,
      availableSeats: 0,
      occupancyPercentage: 0,
      tableLimit: 5,
    };
  },

  // Create table
  async createTable(locationId: string | number, payload: CreateTablePayload): Promise<TableItem> {
    const res = await api.post<{ success: boolean; table: TableItem; message?: string }>(
      `/api/locations/${locationId}/tables`,
      payload
    );
    return res.table;
  },

  // Get table details by ID
  async getTableDetails(tableId: string | number): Promise<TableDetailsData> {
    const res = await api.get<{ success: boolean; table: TableDetailsData }>(
      `/api/tables/${tableId}`
    );
    return res.table;
  },

  // Update table
  async updateTable(
    tableId: string | number,
    payload: { name?: string; seatLimit?: number; isActive?: boolean }
  ): Promise<void> {
    await api.put(`/api/tables/${tableId}`, payload);
  },

  // Toggle table status
  async toggleTableStatus(tableId: string | number): Promise<number> {
    const res = await api.patch<{ success: boolean; isActive: number }>(`/api/tables/${tableId}/status`);
    return res.isActive;
  },

  // Delete table
  async deleteTable(tableId: string | number): Promise<void> {
    await api.delete(`/api/tables/${tableId}`);
  },

  // Add seats (expand seat limit)
  async addSeats(
    tableId: string | number,
    params: { seatLimit?: number; additionalSeats?: number } | number
  ): Promise<number> {
    const payload = typeof params === "number" ? { seatLimit: params } : params;
    const res = await api.post<{ success: boolean; seatLimit: number }>(
      `/api/tables/${tableId}/seats`,
      payload
    );
    return res.seatLimit;
  },

  // Assign employee to seat
  async assignSeat(
    seatId: string,
    payload: { employeeId?: string; employeeName: string; employeeEmail: string }
  ): Promise<void> {
    await api.patch(`/api/seats/${seatId}/assign`, payload);
  },

  // Unassign employee from seat
  async unassignSeat(seatId: string): Promise<void> {
    await api.patch(`/api/seats/${seatId}/unassign`);
  },

  // Transfer employee to another seat
  async transferSeat(sourceSeatId: string, targetSeatId: string): Promise<void> {
    await api.post(`/api/seats/${sourceSeatId}/transfer`, { targetSeatId });
  },

  // Get table orders with optional date filter
  async getTableOrders(tableId: string | number, range?: string): Promise<any[]> {
    const res = await api.get<{ success: boolean; orders: any[] }>(
      `/api/tables/${tableId}/orders${range ? `?range=${range}` : ""}`
    );
    return res?.orders || [];
  },

  // Update seat status (available | blocked)
  async updateSeatStatus(seatId: string, status: "available" | "blocked"): Promise<void> {
    await api.patch(`/api/seats/${seatId}/status`, { status });
  },

  // Get location-wide occupied employees
  async getLocationOccupiedEmployees(
    locationId: string | number,
    params?: { search?: string; tableId?: string | number; seatNumber?: string | number; page?: number; limit?: number }
  ): Promise<OccupiedEmployeesResponse> {
    const query = new URLSearchParams();
    if (params?.search) query.set("search", params.search);
    if (params?.tableId && params.tableId !== "all") query.set("tableId", String(params.tableId));
    if (params?.seatNumber && params.seatNumber !== "all") query.set("seatNumber", String(params.seatNumber));
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));

    const qs = query.toString();
    const res = await api.get<OccupiedEmployeesResponse>(
      `/api/locations/${locationId}/occupied-employees${qs ? `?${qs}` : ""}`
    );
    return res;
  },

  // Get seat details with employee QR and order stats
  async getSeatDetails(seatId: string): Promise<EmployeeSeatProfileDetails> {
    const res = await api.get<{ success: boolean; details: EmployeeSeatProfileDetails }>(
      `/api/seats/${encodeURIComponent(seatId)}/details`
    );
    return res.details;
  },
};

export default tableService;
