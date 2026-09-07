import { Navigate, Outlet } from "react-router-dom";
import { AlertTriangle, RotateCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import AdminLogin from "@/pages/admin/AdminLogin";
import AppLoadingScreen from "@/components/AppLoadingScreen";
import { Button } from "@/components/ui/button";

/**
 * Guard for every /admin route.
 *
 * Unlike ProtectedRoute (which sends anonymous visitors to the member
 * login), this renders the dedicated administrator sign-in in place, so
 * /admin never shows the normal user login.
 *
 * The role is read from the profiles table via AuthContext — never from
 * localStorage, a URL parameter, or any other client-controlled value.
 * The database's RLS policies are the real enforcement; this guard only
 * decides what to draw.
 *
 * Fails closed: an unknown role gets an error state, not the panel.
 */
export default function AdminRoute() {
  const { isAuthenticated, loading, role, isActive, profileError, retryInit } = useAuth();

  if (loading) {
    return <AppLoadingScreen message="Verifying administrator session..." />;
  }

  // Not signed in at all -> dedicated admin login.
  if (!isAuthenticated) {
    return <AdminLogin />;
  }

  // Signed in but the profile (and therefore the role) could not be read.
  if (!role) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-xl">
          <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-destructive" />
          <h1 className="text-lg font-semibold">Couldn&apos;t verify your permissions</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {profileError ??
              "Your account role could not be read, so administrator access can't be granted."}
          </p>
          <Button onClick={retryInit} className="mt-6">
            <RotateCw className="h-4 w-4" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // Deactivated accounts never reach the panel.
  if (!isActive) {
    return <Navigate to="/account-disabled" replace />;
  }

  // Signed in as a non-admin (normal user or manager): send them away from
  // the admin area entirely rather than revealing that it exists.
  if (role !== "admin") {
    return <Navigate to={role === "manager" ? "/manager" : "/"} replace />;
  }

  return <Outlet />;
}
