import { api } from "../apiClient";

export interface LocationProviderSummary {
  id: string;
  name: string;
  email: string;
  userName?: string;
  userType?: string;
}

export interface LocationItem {
  id: string;
  displayId?: string;
  name: string;
  status: "Active" | "Inactive";
  totalSeats: number;
  tableLimit?: number;
  assignedProviderId?: string;
  assignedProviderEmail?: string;
  assignedProviderName?: string;
  assignedProviders?: LocationProviderSummary[];
  assignedProvidersCount?: number;
  shortCode?: string;
  image?: string;
  organizationId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SeatItem {
  id: string;
  displayId?: string;
  locationId?: string;
  organizationId?: string;
  number: string;
  employee?: string;
  employeeName?: string;
  employeeEmail?: string;
  employeeId?: string;
  employeeUserName?: string;
  employeeQrToken?: string;
  assignmentId?: string;
  assignedAt?: string;
  qrToken?: string;
  orderUrl?: string;
  isOccupied?: boolean;
  status?: "Occupied" | "Available";
}

export interface SeatAssignmentItem {
  id: string;
  assignedAt: string;
  createdAt: string;
  employeeId: string;
  employeeName: string;
  userName?: string;
  email: string;
  qrToken?: string;
  organizationId: string;
  organizationName: string;
  organizationShortCode?: string;
  locationId: string;
  locationName: string;
  seatId: string;
  seatDisplayId?: string;
  seatNumber: string;
  orderUrl?: string;
}

export interface GetAssignmentsParams {
  search?: string;
  page?: number;
  limit?: number;
}

export interface GetAssignmentsResponse {
  success: boolean;
  assignments: SeatAssignmentItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface GetLocationsParams {
  providerId?: string;
  shortCode?: string;
  organizationId?: string;
}

export interface AssignProviderPayload {
  assignedProviderId?: string;
  assignedProviderEmail?: string;
  assignedProviderName?: string;
}

export const locationApi = {
  async getLocations(
    paramsOrProviderId?: GetLocationsParams | string,
    shortCode?: string
  ): Promise<LocationItem[]> {
    let params: Record<string, any> = {};

    if (typeof paramsOrProviderId === "string") {
      if (paramsOrProviderId) params.providerId = paramsOrProviderId;
      if (shortCode) params.shortCode = shortCode;
    } else if (paramsOrProviderId) {
      params = { ...paramsOrProviderId };
    }

    const res = await api.get<{ success: boolean; locations: LocationItem[] }>(
      "/api/locations",
      params
    );
    return res.locations || [];
  },

  async getLocationById(id: string): Promise<LocationItem> {
    const res = await api.get<{ success: boolean; location: LocationItem }>(`/api/locations/${id}`);
    return res.location;
  },

  async checkLocationName(
    name: string,
    excludeLocationId?: string,
    signal?: AbortSignal
  ): Promise<{ success: boolean; available: boolean; message: string }> {
    const params: Record<string, string> = { name: name.trim() };
    if (excludeLocationId) params.excludeLocationId = excludeLocationId.trim();
    return await api.get<{ success: boolean; available: boolean; message: string }>(
      "/api/locations/check-name",
      params,
      { signal }
    );
  },

  async createLocation(location: Partial<LocationItem>): Promise<LocationItem> {
    const res = await api.post<{ success: boolean; location: LocationItem }>(
      "/api/locations",
      location
    );
    return res.location;
  },

  async updateLocation(id: string, updates: Partial<LocationItem>): Promise<LocationItem> {
    const res = await api.put<{ success: boolean; location: LocationItem }>(
      `/api/locations/${id}`,
      updates
    );
    return res.location;
  },

  async assignProvider(
    locationId: string,
    provider: { assignedProviderId?: string; assignedProviderEmail?: string; assignedProviderName?: string; providerIds?: string[] }
  ): Promise<LocationItem> {
    const res = await api.post<{ success: boolean; location: LocationItem }>(
      `/api/locations/${locationId}/assign`,
      provider
    );
    return res.location;
  },

  async getLocationProviders(locationId: string): Promise<LocationProviderSummary[]> {
    const res = await api.get<{ success: boolean; providers: LocationProviderSummary[] }>(
      `/api/locations/${locationId}/providers`
    );
    return res.providers || [];
  },

  async removeProviderFromLocation(locationId: string, providerId: string): Promise<void> {
    await api.delete<{ success: boolean }>(`/api/locations/${locationId}/providers/${providerId}`);
  },

  async deleteLocation(id: string): Promise<void> {
    await api.delete<{ success: boolean }>(`/api/locations/${id}`);
  },

  async checkEmployeeEmail(
    locationId: string,
    email: string,
    excludeSeatId?: string,
    signal?: AbortSignal
  ): Promise<{ success: boolean; available: boolean; message: string }> {
    const params: Record<string, string> = { email: email.trim().toLowerCase() };
    if (excludeSeatId) params.excludeSeatId = excludeSeatId.trim();
    return await api.get<{ success: boolean; available: boolean; message: string }>(
      `/api/locations/${locationId}/seats/check-employee-email`,
      params,
      { signal }
    );
  },

  async getSeats(locationId: string): Promise<SeatItem[]> {
    const res = await api.get<{ success: boolean; seats: SeatItem[] }>(`/api/locations/${locationId}/seats`);
    return res.seats || [];
  },

  async saveSeat(locationId: string, seat: Partial<SeatItem>): Promise<SeatItem> {
    const res = await api.post<{ success: boolean; seat: SeatItem }>(`/api/locations/${locationId}/seats`, seat);
    return res.seat;
  },

  async unassignSeat(locationId: string, seatId: string): Promise<SeatItem> {
    const res = await api.post<{ success: boolean; message: string; seat: SeatItem }>(
      `/api/locations/${locationId}/seats/${encodeURIComponent(seatId)}/unassign`
    );
    return res.seat;
  },

  async assignSeat(
    locationId: string,
    seatId: string,
    payload: { employeeId?: string; employeeName?: string; employeeEmail?: string; employee?: string; orderUrl?: string }
  ): Promise<SeatItem> {
    const res = await api.post<{ success: boolean; message: string; seat: SeatItem }>(
      `/api/locations/${locationId}/seats/${encodeURIComponent(seatId)}/assign`,
      payload
    );
    return res.seat;
  },

  async deleteSeat(locationId: string, seatId: string): Promise<void> {
    await api.delete<{ success: boolean; message: string }>(
      `/api/locations/${locationId}/seats/${encodeURIComponent(seatId)}`
    );
  },


};

export const locationService = locationApi;
export default locationService;
