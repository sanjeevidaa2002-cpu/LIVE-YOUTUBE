import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const from = (location.state as { from?: string } | null)?.from;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: signInError } = await signIn(email, password, rememberMe);

    if (signInError) {
      setError(signInError);
      setLoading(false);
      return;
    }

    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;
    let role: string | null = null;
    if (userId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, is_active")
        .eq("id", userId)
        .single();
      role = profile?.role ?? null;
      if (profile && profile.is_active === false) {
        await supabase.auth.signOut();
        setError("Your account has been deactivated. Please contact an administrator.");
        setLoading(false);
        return;
      }
    }

    toast({ title: "Welcome back!", description: "You're now signed in." });

    if (from) {
      navigate(from, { replace: true });
    } else if (role === "admin") {
      navigate("/admin", { replace: true });
    } else if (role === "manager") {
      navigate("/manager", { replace: true });
    } else {
      navigate("/", { replace: true });
    }
    setLoading(false);
  }

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Sign in to your account</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Welcome back. Enter your details to continue.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/forgot-password" className="text-xs text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Switch id="remember" checked={rememberMe} onCheckedChange={setRememberMe} />
            <Label htmlFor="remember" className="cursor-pointer text-sm font-normal">
              Remember me
            </Label>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Sign In
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link to="/signup" className="text-primary font-medium hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
