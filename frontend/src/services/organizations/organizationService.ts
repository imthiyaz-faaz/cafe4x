import { api } from "../apiClient";

export interface Organization {
  id: string;
  displayId?: string;
  name: string;
  shortCode: string;
  currency: string;
  ownerUserId?: string;
  createdAt?: string;
}

export interface CreateOrganizationPayload {
  name: string;
  shortCode: string;
  currency: string;
  userId?: string;
}

export interface CheckOrgAvailabilityResponse {
  success: boolean;
  available: boolean;
  message: string;
}

export const organizationApi = {
  async checkName(name: string, signal?: AbortSignal): Promise<CheckOrgAvailabilityResponse> {
    return api.get<CheckOrgAvailabilityResponse>(
      "/api/organizations/check-name",
      { name: name.trim() },
      { signal }
    );
  },

  async checkCode(code: string, signal?: AbortSignal): Promise<CheckOrgAvailabilityResponse> {
    return api.get<CheckOrgAvailabilityResponse>(
      "/api/organizations/check-code",
      { code: code.trim().toUpperCase() },
      { signal }
    );
  },

  async getOrganizations(userId?: string): Promise<Organization[]> {
    const params = userId ? { userId } : undefined;
    const res = await api.get<{ success: boolean; organizations: Organization[] }>(
      "/api/organizations",
      params
    );
    return res.organizations || [];
  },

  async createOrganization(data: CreateOrganizationPayload): Promise<Organization> {
    const res = await api.post<{ success: boolean; organization: Organization }>(
      "/api/organizations",
      data
    );
    return res.organization;
  },

  async getOrganization(idOrCode: string): Promise<Organization> {
    const res = await api.get<{ success: boolean; organization: Organization }>(
      `/api/organizations/${encodeURIComponent(idOrCode)}`
    );
    return res.organization;
  },
};

export const organizationService = organizationApi;
export default organizationService;
