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
  const { user, organizations, isAuthenticated, isLoading, switchOrganization } = useAuth();
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

  // Not authenticated? Redirect directly to /login and preserve requested path
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Role check: Admin vs Provider vs Staff
  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = user.userType || "Admin";
    if (!allowedRoles.includes(userRole)) {
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

    // Check if user is authorized for this organization shortcode
    // 1. First check if it matches the currently active organization
    if (activeCode === routeCode) {
      return <>{children}</>;
    }

    // 2. Check user's verified organizations from session/backend
    const matchedOrg = (organizations || []).find(
      (o) => (o.shortCode || "").toUpperCase() === routeCode
    );

    if (matchedOrg) {
      // User is authorized for this organization; sync user state if needed
      try {
        const userRole = user.userType || "Admin";
        const workspace = userRole === "Provider" ? "Provider" : "Admin";
        switchOrganization(
          { id: matchedOrg.id, name: matchedOrg.name, shortCode: matchedOrg.shortCode.toUpperCase() },
          workspace
        );
      } catch {}
      return <>{children}</>;
    }

    // 3. Check if user object has this organization
    if (user.shortCode?.toUpperCase() === routeCode) {
      return <>{children}</>;
    }

    // Not authorized for this organization; redirect to Choose Organization
    return <Navigate to="/home" replace />;
  }

  return <>{children}</>;
}
