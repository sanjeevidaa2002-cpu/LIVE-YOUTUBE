import { useState, type FormEvent } from "react";
import { Eye, EyeOff, Loader2, ShieldCheck, ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FailureKind = "credentials" | "disabled" | "not_admin" | "session" | null;

/**
 * Dedicated administrator sign-in, shown at /admin for anyone who is not a
 * signed-in admin. Deliberately distinct from the member login at /login.
 *
 * Authentication is Supabase Auth; the admin role is then read from the
 * profiles table (server-side, RLS-protected). No credential or role is
 * ever kept in localStorage, and nothing here trusts client state.
 */
export default function AdminLogin() {
  const { signOut } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState<FailureKind>(null);
  const [detail, setDetail] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFailure(null);
    setDetail(null);
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        setFailure("credentials");
        setDetail(error.message);
        return;
      }

      const userId = data.user?.id;
      if (!userId) {
        setFailure("session");
        setDetail("Sign-in succeeded but no session was returned.");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, is_active")
        .eq("id", userId)
        .maybeSingle();

      if (profileError) {
        setFailure("session");
        setDetail(profileError.message);
        await supabase.auth.signOut();
        return;
      }

      if (!profile) {
        setFailure("not_admin");
        await supabase.auth.signOut();
        return;
      }

      if (profile.is_active === false) {
        setFailure("disabled");
        await supabase.auth.signOut();
        return;
      }

      if (profile.role !== "admin") {
        // Signed in, but not an administrator. End the session started here
        // so a non-admin is never left holding one from the admin door.
        setFailure("not_admin");
        await signOut();
        return;
      }

      // Success: AuthProvider's onAuthStateChange picks up the session and
      // AdminRoute re-renders the panel. No manual navigation needed.
    } catch (err) {
      setFailure("session");
      setDetail(err instanceof Error ? err.message : "Unexpected error during sign-in.");
    } finally {
      setLoading(false);
    }
  }

  const message =
    failure === "credentials"
      ? "Invalid administrator credentials."
      : failure === "disabled"
        ? "This account has been deactivated. Contact another administrator."
        : failure === "not_admin"
          ? "This account does not have administrator access."
          : failure === "session"
            ? "Could not establish an administrator session."
            : null;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-12">
      {/* Distinct from the member login: cool slate wash, not the purple hero */}
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-slate-500/10 blur-3xl" />
        <div className="absolute -bottom-40 right-0 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-secondary">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">StreamVault Admin</h1>
          <p className="text-sm text-muted-foreground">Administrator Access</p>
        </div>

        <div className="rounded-2xl border border-border bg-card/90 p-8 shadow-2xl backdrop-blur-sm">
          <h2 className="mb-1 text-lg font-semibold">Administrator Login</h2>
          <p className="mb-6 text-sm text-muted-foreground">
            Sign in with an account that holds the admin role.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-email">Admin Email</Label>
              <Input
                id="admin-email"
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-password">Password</Label>
              <div className="relative">
                <Input
                  id="admin-password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pr-10"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {message && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p>{message}</p>
                  {detail && failure === "session" && (
                    <p className="mt-1 text-xs opacity-80">{detail}</p>
                  )}
                </div>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Sign In to Admin Panel
            </Button>
          </form>

          <div className="mt-6 flex items-center justify-between text-xs">
            <Link to="/forgot-password" className="text-primary hover:underline">
              Forgot password?
            </Link>
            <Link to="/" className="text-muted-foreground hover:text-foreground">
              Back to site
            </Link>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Authorized administrators only. All administrative actions are logged.
        </p>
      </div>
    </div>
  );
}
