import { api } from "../apiClient";

export interface LocationItem {
  id: string;
  displayId?: string;
  name: string;
  status: "Active" | "Inactive";
  totalSeats: number;
  assignedProviderId?: string;
  assignedProviderEmail?: string;
  assignedProviderName?: string;
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
  orderUrl?: string;
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

  async assignProvider(locationId: string, provider: AssignProviderPayload): Promise<LocationItem> {
    const res = await api.post<{ success: boolean; location: LocationItem }>(
      `/api/locations/${locationId}/assign`,
      provider
    );
    return res.location;
  },

  async deleteLocation(id: string): Promise<void> {
    await api.delete<{ success: boolean }>(`/api/locations/${id}`);
  },

  async getSeats(locationId: string): Promise<SeatItem[]> {
    const res = await api.get<{ success: boolean; seats: SeatItem[] }>(`/api/locations/${locationId}/seats`);
    return res.seats || [];
  },

  async saveSeat(locationId: string, seat: Partial<SeatItem>): Promise<SeatItem> {
    const res = await api.post<{ success: boolean; seat: SeatItem }>(`/api/locations/${locationId}/seats`, seat);
    return res.seat;
  },
};

export const locationService = locationApi;
export default locationService;
