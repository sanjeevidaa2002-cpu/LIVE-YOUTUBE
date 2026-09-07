import { Navigate, Outlet, useLocation } from "react-router-dom";
import { AlertTriangle, RotateCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import type { UserRole } from "@/types";
import AppLoadingScreen from "@/components/AppLoadingScreen";
import { Button } from "@/components/ui/button";

interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
}

function AccessErrorScreen({
  title,
  description,
  onRetry,
}: {
  title: string;
  description: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-xl">
        <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-destructive" />
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        <Button onClick={onRetry} className="mt-6">
          <RotateCw className="h-4 w-4" />
          Try Again
        </Button>
      </div>
    </div>
  );
}

/**
 * Route guard. This is a UX convenience only — the real enforcement of
 * who may read/write what lives in Postgres RLS policies (see
 * supabase/schema.sql). Even if this check were bypassed, Supabase would
 * still reject unauthorized reads/writes at the database layer.
 *
 * The guard fails CLOSED: if the signed-in user's role cannot be
 * determined, role-restricted routes render an error state rather than
 * being allowed through.
 */
export default function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, loading, role, isActive, authError, profileError, retryInit } =
    useAuth();
  const location = useLocation();

  if (loading) {
    return <AppLoadingScreen message="Checking your session..." />;
  }

  if (authError && !isAuthenticated) {
    return (
      <AccessErrorScreen
        title="Connection problem"
        description={`We couldn't verify your session. ${authError}`}
        onRetry={retryInit}
      />
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (!isActive) {
    return <Navigate to="/account-disabled" replace />;
  }

  // Fail closed: a role-restricted route must never be entered on an
  // unknown role. Previously `role && ...` short-circuited here, letting a
  // failed profile fetch through to the admin/manager shell.
  if (allowedRoles && !role) {
    return (
      <AccessErrorScreen
        title="Couldn't load your permissions"
        description={
          profileError
            ? `Your account role could not be read, so access can't be granted. ${profileError}`
            : "Your account role could not be read, so access can't be granted."
        }
        onRetry={retryInit}
      />
    );
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
