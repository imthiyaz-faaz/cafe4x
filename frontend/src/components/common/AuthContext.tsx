import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { authApi, type AuthUser, type UserOrganizationInfo } from "../../services/auth";

interface AuthContextType {
  user: AuthUser | null;
  organizations: UserOrganizationInfo[];
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  checkAuth: () => Promise<boolean>;
  login: (token: string, user: AuthUser, orgs?: UserOrganizationInfo[]) => void;
  logout: () => Promise<void>;
  switchOrganization: (org: { id: string; name: string; shortCode: string }) => void;
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
    } catch {
      // Ignore network errors
    } finally {
      localStorage.removeItem("cafe4x_token");
      localStorage.removeItem("cafe4x_currentUser");
      localStorage.removeItem("cafe4x_organizations");
      localStorage.removeItem("cafe4x_userOrganizations");
      setToken(null);
      setUser(null);
      setOrganizations([]);
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
        // Keep active organization context if present
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

        if (Array.isArray((res as any).organizations) && (res as any).organizations.length > 0) {
          setOrganizations((res as any).organizations);
          localStorage.setItem("cafe4x_organizations", JSON.stringify((res as any).organizations));
        }

        setIsLoading(false);
        return true;
      } else {
        // Token was rejected or invalid
        await logout();
        setIsLoading(false);
        return false;
      }
    } catch (err: any) {
      // Any failure to verify the session (401, network, invalid token) logs out the user
      // so stale sessions cannot bypass the login screen or protected routes.
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
      }
    },
    []
  );

  const switchOrganization = useCallback(
    (org: { id: string; name: string; shortCode: string }) => {
      setUser((prev) => {
        if (!prev) return null;
        const updated: AuthUser = {
          ...prev,
          organization: org.name,
          shortCode: org.shortCode.toUpperCase(),
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
