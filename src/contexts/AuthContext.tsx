import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/types";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  /** Session bootstrap failed (network/Supabase unreachable). */
  authError: string | null;
  /** Signed in, but the profile row (and therefore the role) could not be read. */
  profileError: string | null;
  isAuthenticated: boolean;
  role: Profile["role"] | null;
  isAdmin: boolean;
  isManager: boolean;
  isActive: boolean;
  retryInit: () => void;
  signUp: (
    email: string,
    password: string,
    fullName: string,
  ) => Promise<{ error: string | null }>;
  signIn: (
    email: string,
    password: string,
    rememberMe: boolean,
  ) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [initAttempt, setInitAttempt] = useState(0);

  const retryInit = useCallback(() => {
    setLoading(true);
    setAuthError(null);
    setProfileError(null);
    setInitAttempt((n) => n + 1);
  }, []);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) {
        console.error("[StreamVault] Failed to load profile:", error.message);
        setProfile(null);
        setProfileError(error.message);
        return;
      }
      setProfile(data);
      setProfileError(null);
    } catch (err) {
      // Thrown (rather than returned) errors happen when the network request
      // itself fails — offline, DNS failure, CORS, Supabase unreachable.
      const message = err instanceof Error ? err.message : "Could not reach the server.";
      console.error("[StreamVault] Profile request failed:", message);
      setProfile(null);
      setProfileError(message);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    // Guard against a session request that never settles (flaky mobile
    // networks, blocked host). Without this the app would sit on a spinner
    // forever, since `loading` would never flip to false.
    const timeoutId = setTimeout(() => {
      if (!mounted) return;
      setLoading((stillLoading) => {
        if (stillLoading) {
          setAuthError(
            "Timed out while contacting the authentication server. Check your connection and try again.",
          );
        }
        return false;
      });
    }, 15000);

    supabase.auth
      .getSession()
      .then(async ({ data, error }) => {
        if (!mounted) return;
        if (error) {
          console.error("[StreamVault] getSession error:", error.message);
          setAuthError(error.message);
        }
        setSession(data.session);
        setUser(data.session?.user ?? null);
        if (data.session?.user) {
          await fetchProfile(data.session.user.id);
        }
      })
      .catch((err: unknown) => {
        // A rejected promise here previously skipped setLoading(false)
        // entirely, pinning the app on an infinite loading state.
        const message =
          err instanceof Error ? err.message : "Could not reach the authentication server.";
        console.error("[StreamVault] Session initialization failed:", message);
        if (mounted) setAuthError(message);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        if (!mounted) return;
        setSession(newSession);
        setUser(newSession?.user ?? null);
        if (newSession?.user) {
          await fetchProfile(newSession.user.id);
        } else {
          setProfile(null);
          setProfileError(null);
        }
        setLoading(false);
      },
    );

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      listener.subscription.unsubscribe();
    };
  }, [fetchProfile, initAttempt]);

  const signUp = useCallback(
    async (email: string, password: string, fullName: string) => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
        },
      });
      return { error: error?.message ?? null };
    },
    [],
  );

  const signIn = useCallback(
    async (email: string, password: string, rememberMe: boolean) => {
      // Supabase always persists the session in localStorage via our
      // client config. "Remember me" toggles whether we keep it beyond
      // this browser tab's lifetime; when off, we clear it on sign-out
      // of the tab via sessionStorage marker instead of forcing a
      // non-persistent client (which would break refresh-on-reload UX).
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (!error) {
        if (rememberMe) {
          window.localStorage.setItem("streamvault-remember", "1");
        } else {
          window.localStorage.removeItem("streamvault-remember");
        }
      }
      return { error: error?.message ?? null };
    },
    [],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    window.localStorage.removeItem("streamvault-remember");
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    const redirectTo = `${window.location.origin}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    return { error: error?.message ?? null };
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error?.message ?? null };
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id);
  }, [user, fetchProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      profile,
      loading,
      authError,
      profileError,
      isAuthenticated: !!user,
      role: profile?.role ?? null,
      isAdmin: profile?.role === "admin",
      isManager: profile?.role === "manager",
      isActive: profile?.is_active ?? true,
      retryInit,
      signUp,
      signIn,
      signOut,
      sendPasswordReset,
      updatePassword,
      refreshProfile,
    }),
    [
      user,
      session,
      profile,
      loading,
      authError,
      profileError,
      retryInit,
      signUp,
      signIn,
      signOut,
      sendPasswordReset,
      updatePassword,
      refreshProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
