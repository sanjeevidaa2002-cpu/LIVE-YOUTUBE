import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import type { UserRole } from "@/types";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
}

/**
 * Route guard. This is a UX convenience only — the real enforcement of
 * who may read/write what lives in Postgres RLS policies (see
 * supabase/schema.sql). Even if this check were bypassed, Supabase would
 * still reject unauthorized reads/writes at the database layer.
 */
export default function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, loading, role, isActive } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (!isActive) {
    return <Navigate to="/account-disabled" replace />;
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
