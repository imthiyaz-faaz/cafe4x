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

    // If user's active organization does not match the URL shortCode, allow seamless organization match if user has access
    if (activeCode && activeCode !== routeCode) {
      // Stored user is in another organization; redirect to Choose Organization
      return <Navigate to="/home" replace />;
    }
  }

  return <>{children}</>;
}
