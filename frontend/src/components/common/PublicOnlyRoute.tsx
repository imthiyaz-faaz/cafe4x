import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { Loader2 } from "lucide-react";

interface PublicOnlyRouteProps {
  children: React.ReactNode;
}

/**
 * Route guard for authentication pages (/login, /signup, etc.).
 * If an already-authenticated user tries to visit an auth page, redirect them:
 * - To their specific dashboard if an authorized organization is already active/selected
 * - To /home (Choose Organization) if they have not yet selected an organization
 * - If still loading auth status, displays a loading spinner instead of flickering the form
 */
export default function PublicOnlyRoute({ children }: PublicOnlyRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[#FAF6F1]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="animate-spin text-[#8B5738]" size={36} />
          <p className="text-sm font-semibold tracking-wide text-[#70523E]">
            Checking authentication...
          </p>
        </div>
      </div>
    );
  }

  if (isAuthenticated && user) {
    // If the user has an intended redirect target (e.g. from state), or route to dashboard
    const userRole = user.userType || "Admin";
    const short = (user.shortCode || "").toUpperCase();

    // Check if user came from a requested return path
    const returnTo = (location.state as any)?.from || (location.state as any)?.returnTo;
    if (returnTo?.pathname && returnTo.pathname !== "/login" && returnTo.pathname !== "/signup") {
      return <Navigate to={returnTo.pathname + (returnTo.search || "")} replace />;
    }

    if (userRole === "Provider") {
      return <Navigate to={short ? `/${short}/provider` : "/provider"} replace />;
    }

    if (short) {
      return <Navigate to={`/${short}/landing`} replace />;
    }

    return <Navigate to="/home" replace />;
  }

  return <>{children}</>;
}
