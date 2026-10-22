export const API_BASE_URL: string =
  (import.meta as any).env?.VITE_API_BASE_URL ||
  ((import.meta as any).env?.DEV
    ? "http://localhost:8787"
    : "https://cafe4x-api.m-imthiyaz.workers.dev");

export interface ApiRequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined | null>;
}

export function buildUrl(
  endpoint: string,
  params?: Record<string, string | number | boolean | undefined | null>
): string {
  const base = endpoint.startsWith("http")
    ? endpoint
    : `${API_BASE_URL}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

  if (!params) return base;

  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.append(key, String(value));
    }
  });

  const queryString = searchParams.toString();
  return queryString ? `${base}${base.includes("?") ? "&" : "?"}${queryString}` : base;
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const { params, headers: customHeaders, ...fetchOptions } = options;
  const url = buildUrl(endpoint, params);

  const token = localStorage.getItem("cafe4x_token");
  const headers = new Headers(customHeaders || {});

  // Automatically attach active organization and current user context
  try {
    const isProviderWorkspace =
      typeof window !== "undefined" &&
      (window.location.pathname.toLowerCase().includes("/provider") ||
       window.location.pathname.toLowerCase().includes("/fts/provider"));

    const userStr = localStorage.getItem("cafe4x_currentUser");
    const u = userStr ? JSON.parse(userStr) : null;

    if (u?.id && !headers.has("x-user-id")) {
      headers.set("x-user-id", u.id);
    }

    // Determine active organization separately for Provider vs Admin
    let activeOrg: { id?: string; shortCode?: string; name?: string } | null = null;
    if (isProviderWorkspace || u?.userType === "Provider") {
      const storedProviderOrg = localStorage.getItem("cafe4x_provider_activeOrg");
      if (storedProviderOrg) {
        activeOrg = JSON.parse(storedProviderOrg);
      }
    } else {
      const storedAdminOrg = localStorage.getItem("cafe4x_admin_activeOrg");
      if (storedAdminOrg) {
        activeOrg = JSON.parse(storedAdminOrg);
      }
    }

    const effectiveShortCode = activeOrg?.shortCode || u?.shortCode;
    const effectiveOrgId = activeOrg?.id || u?.organizationId;

    if (effectiveShortCode && !headers.has("x-shortcode")) {
      headers.set("x-shortcode", effectiveShortCode.toUpperCase());
    }
    if (effectiveOrgId && !headers.has("x-organization-id")) {
      headers.set("x-organization-id", effectiveOrgId);
    }
  } catch {}

  if (!headers.has("Content-Type") && !(fetchOptions.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...fetchOptions,
    headers,
  });

  const text = await response.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text || `HTTP error ${response.status}` };
  }

  if (!response.ok) {
    if (response.status === 401 && !endpoint.includes("/api/auth/login") && !endpoint.includes("/api/auth/signup")) {
      localStorage.removeItem("cafe4x_token");
      localStorage.removeItem("cafe4x_currentUser");
      localStorage.removeItem("cafe4x_userOrganizations");
      localStorage.removeItem("cafe4x_organizations");
      window.dispatchEvent(new Event("cafe4x_auth_expired"));
    }

    const errorMsg =
      data.message ||
      data.error ||
      `Request failed with status ${response.status} (${response.statusText})`;
    throw new Error(errorMsg);
  }

  return data as T;
}

export const api = {
  get: <T = any>(endpoint: string, params?: Record<string, any>, options?: RequestInit) =>
    apiRequest<T>(endpoint, { ...options, method: "GET", params }),

  post: <T = any>(endpoint: string, body?: any, options?: RequestInit) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: "POST",
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),

  put: <T = any>(endpoint: string, body?: any, options?: RequestInit) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: "PUT",
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),

  patch: <T = any>(endpoint: string, body?: any, options?: RequestInit) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),

  delete: <T = any>(endpoint: string, options?: RequestInit) =>
    apiRequest<T>(endpoint, { ...options, method: "DELETE" }),
};

export const apiFetch = apiRequest;
export default api;
