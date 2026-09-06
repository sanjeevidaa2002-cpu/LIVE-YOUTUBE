import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";

export default function ResetPassword() {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();

  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Supabase places the recovery session in the URL hash and the client
    // auto-detects it (detectSessionInUrl: true). We just need to wait for
    // a session to exist before allowing the user to set a new password.
    supabase.auth.getSession().then(({ data }) => {
      setReady(!!data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setReady(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);
    const { error: updateError } = await updatePassword(password);
    setLoading(false);

    if (updateError) {
      setError(updateError);
      return;
    }

    setSuccess(true);
    setTimeout(() => navigate("/login"), 2000);
  }

  if (success) {
    return (
      <div className="text-center py-6">
        <h1 className="text-xl font-semibold mb-2">Password updated</h1>
        <p className="text-sm text-muted-foreground">Redirecting you to sign in...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Set a new password</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Choose a strong password for your account.
      </p>

      {!ready ? (
        <p className="text-sm text-muted-foreground">
          Validating your reset link... If this page was not opened from a password reset
          email, please request a new link.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">New Password</Label>
            <Input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your new password"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Update Password
          </Button>
        </form>
      )}
    </div>
  );
}
