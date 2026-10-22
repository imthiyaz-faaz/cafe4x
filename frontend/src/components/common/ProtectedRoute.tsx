import React from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  requireOrgMatch?: boolean;
}

export default function ProtectedRoute({
  children,
  allowedRoles,
  requireOrgMatch = false,
}: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  const params = useParams();

  // Show a clean coffee-themed spinner while verifying session with server
  if (isLoading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[#FAF6F1]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="animate-spin text-[#8B5738]" size={36} />
          <p className="text-sm font-semibold tracking-wide text-[#70523E]">
            Verifying authentication...
          </p>
        </div>
      </div>
    );
  }

  // Not authenticated? Redirect directly to /login
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Role check: Admin vs Provider vs Staff
  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = user.userType || "Admin";
    if (!allowedRoles.includes(userRole)) {
      // If a Provider tries to enter Admin routes or vice versa, redirect them to their home
      if (userRole === "Provider") {
        const short = user.shortCode ? user.shortCode.toUpperCase() : "";
        return <Navigate to={short ? `/${short}/provider` : "/provider"} replace />;
      }
      return <Navigate to="/home" replace />;
    }
  }

  // If route is scoped to /:shortCode, ensure user is authorized for that organization
  if (requireOrgMatch && params.shortCode) {
    const routeCode = params.shortCode.toUpperCase();
    const activeCode = (user.shortCode || "").toUpperCase();

    // Check if the route shortCode matches user's active code or any authorized organization
    if (activeCode !== routeCode) {
      let isAuthorized = false;
      let matchedOrg: { id: string; name: string; shortCode: string } | null = null;

      // 1. Check user object's organizations if present
      if (Array.isArray((user as any).organizations)) {
        const found = (user as any).organizations.find(
          (o: any) => (o.shortCode || "").toUpperCase() === routeCode
        );
        if (found) {
          isAuthorized = true;
          matchedOrg = {
            id: String(found.id),
            name: found.name,
            shortCode: (found.shortCode || "").toUpperCase(),
          };
        }
      }

      // 2. Check localStorage "cafe4x_currentUser"
      if (!isAuthorized) {
        try {
          const storedUser = localStorage.getItem("cafe4x_currentUser");
          if (storedUser) {
            const parsedUser = JSON.parse(storedUser);
            if ((parsedUser.shortCode || "").toUpperCase() === routeCode) {
              isAuthorized = true;
              matchedOrg = {
                id: String(parsedUser.organizationId || parsedUser.id || ""),
                name: parsedUser.organization || `${routeCode} Workplace`,
                shortCode: routeCode,
              };
            }
          }
        } catch {}
      }

      // 3. Check localStorage "cafe4x_admin_activeOrg" or "cafe4x_provider_activeOrg"
      if (!isAuthorized) {
        try {
          const storedAdminOrg = localStorage.getItem("cafe4x_admin_activeOrg");
          if (storedAdminOrg) {
            const parsed = JSON.parse(storedAdminOrg);
            if ((parsed.shortCode || "").toUpperCase() === routeCode) {
              isAuthorized = true;
              matchedOrg = {
                id: String(parsed.id || ""),
                name: parsed.name || `${routeCode} Workplace`,
                shortCode: routeCode,
              };
            }
          }
        } catch {}
      }

      // 4. Check cached organizations in "cafe4x_organizations"
      if (!isAuthorized) {
        try {
          const storedOrgs = localStorage.getItem("cafe4x_organizations");
          const orgList = storedOrgs ? JSON.parse(storedOrgs) : [];
          const found = orgList.find(
            (o: any) => (o.shortCode || "").toUpperCase() === routeCode
          );
          if (found) {
            isAuthorized = true;
            matchedOrg = {
              id: String(found.id || ""),
              name: found.name || `${routeCode} Workplace`,
              shortCode: (found.shortCode || "").toUpperCase(),
            };
          }
        } catch {}
      }

      // If user is authorized to access the organization, allow access and sync user state in background
      if (isAuthorized) {
        if (matchedOrg && user.shortCode?.toUpperCase() !== routeCode) {
          try {
            const updated = {
              ...user,
              organization: matchedOrg.name,
              shortCode: matchedOrg.shortCode.toUpperCase(),
              organizationId: matchedOrg.id,
            };
            localStorage.setItem("cafe4x_currentUser", JSON.stringify(updated));
          } catch {}
        }
      } else {
        // Not authorized for this organization; redirect to Choose Organization
        return <Navigate to="/home" replace />;
      }
    }
  }

  return <>{children}</>;
}
