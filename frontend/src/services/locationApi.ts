import { apiFetch } from "./apiClient";

export interface LocationItem {
  id: string;
  name: string;
  status: "Active" | "Inactive";
  totalSeats: number;
  assignedProviderId?: string;
  assignedProviderEmail?: string;
  assignedProviderName?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const locationApi = {
  async getLocations(providerId?: string, shortCode?: string): Promise<LocationItem[]> {
    const params = new URLSearchParams();
    if (providerId) params.append("providerId", providerId);
    if (shortCode) params.append("shortCode", shortCode);
    const query = params.toString() ? `?${params.toString()}` : "";
    const res = await apiFetch<{ success: boolean; locations: LocationItem[] }>(`/api/locations${query}`);
    return res.locations || [];
  },

  async createLocation(location: Partial<LocationItem>): Promise<LocationItem> {
    const res = await apiFetch<{ success: boolean; location: LocationItem }>("/api/locations", {
      method: "POST",
      body: JSON.stringify(location),
    });
    return res.location;
  },

  async updateLocation(id: string, updates: Partial<LocationItem>): Promise<LocationItem> {
    const res = await apiFetch<{ success: boolean; location: LocationItem }>(`/api/locations/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });
    return res.location;
  },

  async assignProvider(
    locationId: string,
    provider: {
      assignedProviderId?: string;
      assignedProviderEmail?: string;
      assignedProviderName?: string;
    }
  ): Promise<LocationItem> {
    const res = await apiFetch<{ success: boolean; location: LocationItem }>(
      `/api/locations/${locationId}/assign`,
      {
        method: "POST",
        body: JSON.stringify(provider),
      }
    );
    return res.location;
  },

  async deleteLocation(id: string): Promise<void> {
    await apiFetch<{ success: boolean }>(`/api/locations/${id}`, {
      method: "DELETE",
    });
  },
};
