import { apiFetch } from "./apiClient";

export interface Organization {
  id: string;
  name: string;
  shortCode: string;
  ownerUserId?: string;
  createdAt?: string;
}

export const organizationApi = {
  async getOrganizations(userId?: string): Promise<Organization[]> {
    const query = userId ? `?userId=${encodeURIComponent(userId)}` : "";
    const res = await apiFetch<{ success: boolean; organizations: Organization[] }>(`/api/organizations${query}`);
    return res.organizations || [];
  },

  async createOrganization(data: { name: string; shortCode: string; userId?: string }): Promise<Organization> {
    const res = await apiFetch<{ success: boolean; organization: Organization }>("/api/organizations", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return res.organization;
  },
};
