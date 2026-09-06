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
  isAuthenticated: boolean;
  role: Profile["role"] | null;
  isAdmin: boolean;
  isManager: boolean;
  isActive: boolean;
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

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("Failed to load profile:", error.message);
      setProfile(null);
      return;
    }
    setProfile(data);
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        await fetchProfile(data.session.user.id);
      }
      setLoading(false);
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
        }
        setLoading(false);
      },
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [fetchProfile]);

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
      isAuthenticated: !!user,
      role: profile?.role ?? null,
      isAdmin: profile?.role === "admin",
      isManager: profile?.role === "manager",
      isActive: profile?.is_active ?? true,
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
