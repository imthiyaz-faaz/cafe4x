import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { authApi, type AuthUser, type UserOrganizationInfo } from "../../services/auth";
import { ApiError } from "../../services/apiClient";

interface AuthContextType {
  user: AuthUser | null;
  organizations: UserOrganizationInfo[];
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  checkAuth: () => Promise<boolean>;
  login: (token: string, user: AuthUser, orgs?: UserOrganizationInfo[]) => void;
  logout: () => Promise<void>;
  switchOrganization: (
    org: { id: string; name: string; shortCode: string },
    workspace?: "Admin" | "Provider"
  ) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const stored = localStorage.getItem("cafe4x_currentUser");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [organizations, setOrganizations] = useState<UserOrganizationInfo[]>(() => {
    try {
      const stored = localStorage.getItem("cafe4x_organizations");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem("cafe4x_token");
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch (err) {
      console.warn("Server-side session invalidation encountered an issue:", err);
    } finally {
      localStorage.removeItem("cafe4x_token");
      localStorage.removeItem("cafe4x_currentUser");
      localStorage.removeItem("cafe4x_organizations");
      localStorage.removeItem("cafe4x_userOrganizations");
      localStorage.removeItem("cafe4x_admin_activeOrg");
      localStorage.removeItem("cafe4x_provider_activeOrg");
      setToken(null);
      setUser(null);
      setOrganizations([]);
      setIsLoading(false);
    }
  }, []);

  const checkAuth = useCallback(async (): Promise<boolean> => {
    const currentToken = localStorage.getItem("cafe4x_token");
    if (!currentToken) {
      setUser(null);
      setToken(null);
      setOrganizations([]);
      setIsLoading(false);
      return false;
    }

    try {
      const res = await authApi.me();
      if (res.success && res.user) {
        const storedUser = localStorage.getItem("cafe4x_currentUser");
        const parsedStored = storedUser ? JSON.parse(storedUser) : null;

        const mergedUser: AuthUser = {
          ...res.user,
          organization: parsedStored?.organization || res.user.organization,
          shortCode: (parsedStored?.shortCode || res.user.shortCode || "").toUpperCase(),
          organizationId: parsedStored?.organizationId || res.user.organizationId,
        };

        setUser(mergedUser);
        setToken(currentToken);
        localStorage.setItem("cafe4x_currentUser", JSON.stringify(mergedUser));

        const userOrgs: UserOrganizationInfo[] = Array.isArray((res as any).organizations)
          ? (res as any).organizations
          : [];

        if (userOrgs.length > 0) {
          setOrganizations(userOrgs);
          localStorage.setItem("cafe4x_organizations", JSON.stringify(userOrgs));

          // Initialize workspace-specific org caches if not set
          if (res.user.userType === "Provider") {
            const currentProv = localStorage.getItem("cafe4x_provider_activeOrg");
            if (!currentProv) {
              const provOrg = userOrgs[0];
              localStorage.setItem(
                "cafe4x_provider_activeOrg",
                JSON.stringify({
                  id: provOrg.id,
                  name: provOrg.name,
                  shortCode: provOrg.shortCode.toUpperCase(),
                })
              );
            }
          } else {
            const currentAdmin = localStorage.getItem("cafe4x_admin_activeOrg");
            if (!currentAdmin) {
              const admOrg = userOrgs.find((o) => o.shortCode?.toUpperCase() === mergedUser.shortCode) || userOrgs[0];
              localStorage.setItem(
                "cafe4x_admin_activeOrg",
                JSON.stringify({
                  id: admOrg.id,
                  name: admOrg.name,
                  shortCode: admOrg.shortCode.toUpperCase(),
                })
              );
            }
          }
        }

        setIsLoading(false);
        return true;
      } else {
        await logout();
        setIsLoading(false);
        return false;
      }
    } catch (err: any) {
      // If server returned 401 Unauthorized or 404 User Not Found, invalidate session
      if (err instanceof ApiError && (err.status === 401 || err.status === 404)) {
        await logout();
        setIsLoading(false);
        return false;
      }

      // For network errors or 5xx server issues, preserve the existing cached session if valid
      const cachedUser = localStorage.getItem("cafe4x_currentUser");
      if (cachedUser && currentToken) {
        try {
          const parsed = JSON.parse(cachedUser);
          setUser(parsed);
          setToken(currentToken);
          setIsLoading(false);
          return true;
        } catch {}
      }

      await logout();
      setIsLoading(false);
      return false;
    }
  }, [logout]);

  useEffect(() => {
    checkAuth();

    const handleAuthExpired = () => {
      logout();
    };

    window.addEventListener("cafe4x_auth_expired", handleAuthExpired);
    return () => {
      window.removeEventListener("cafe4x_auth_expired", handleAuthExpired);
    };
  }, [checkAuth, logout]);

  const login = useCallback(
    (newToken: string, newUser: AuthUser, newOrgs?: UserOrganizationInfo[]) => {
      localStorage.setItem("cafe4x_token", newToken);
      localStorage.setItem("cafe4x_currentUser", JSON.stringify(newUser));
      setToken(newToken);
      setUser(newUser);

      if (newOrgs && newOrgs.length > 0) {
        localStorage.setItem("cafe4x_organizations", JSON.stringify(newOrgs));
        setOrganizations(newOrgs);

        if (newUser.userType === "Provider") {
          const provOrg = newOrgs[0];
          localStorage.setItem(
            "cafe4x_provider_activeOrg",
            JSON.stringify({
              id: provOrg.id,
              name: provOrg.name,
              shortCode: provOrg.shortCode.toUpperCase(),
            })
          );
        } else {
          const admOrg = newOrgs[0];
          localStorage.setItem(
            "cafe4x_admin_activeOrg",
            JSON.stringify({
              id: admOrg.id,
              name: admOrg.name,
              shortCode: admOrg.shortCode.toUpperCase(),
            })
          );
        }
      }
    },
    []
  );

  const switchOrganization = useCallback(
    (
      org: { id: string; name: string; shortCode: string },
      workspace?: "Admin" | "Provider"
    ) => {
      const cleanShort = org.shortCode.toUpperCase();
      const orgData = {
        id: org.id,
        name: org.name,
        shortCode: cleanShort,
      };

      if (workspace === "Provider") {
        localStorage.setItem("cafe4x_provider_activeOrg", JSON.stringify(orgData));
      } else if (workspace === "Admin") {
        localStorage.setItem("cafe4x_admin_activeOrg", JSON.stringify(orgData));
      } else {
        // Infer from current path if not explicitly provided
        const isProv =
          typeof window !== "undefined" &&
          (window.location.pathname.toLowerCase().includes("/provider") ||
           window.location.pathname.toLowerCase().includes("/fts/provider"));
        if (isProv) {
          localStorage.setItem("cafe4x_provider_activeOrg", JSON.stringify(orgData));
        } else {
          localStorage.setItem("cafe4x_admin_activeOrg", JSON.stringify(orgData));
        }
      }

      setUser((prev) => {
        if (!prev) return null;
        const updated: AuthUser = {
          ...prev,
          organization: org.name,
          shortCode: cleanShort,
          organizationId: org.id,
        };
        localStorage.setItem("cafe4x_currentUser", JSON.stringify(updated));
        return updated;
      });
    },
    []
  );

  const value: AuthContextType = {
    user,
    organizations,
    token,
    isAuthenticated: Boolean(token && user),
    isLoading,
    checkAuth,
    login,
    logout,
    switchOrganization,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
