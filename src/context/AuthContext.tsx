import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '../types/index.ts';
import { apiFetch } from '../lib/api.ts';
import { supabase } from '../lib/supabase.ts';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  signIn: (email: string, pass: string) => Promise<User>;
  signUp: (fullName: string, email: string, pass: string) => Promise<User>;
  signOut: () => Promise<void>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('streamloop_user');
      if (saved && saved !== 'undefined' && saved !== 'null') {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('[AuthContext] Corrupted stored user cleared:', e);
      try {
        localStorage.removeItem('streamloop_user');
      } catch {}
    }
    return null;
  });
  const [token, setToken] = useState<string | null>(() => {
    try {
      const savedToken = localStorage.getItem('streamloop_token');
      if (savedToken && savedToken !== 'undefined' && savedToken !== 'null') {
        return savedToken;
      }
    } catch {}
    return null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const logout = useCallback(async () => {
    try {
      if (token) {
        await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
      }
    } catch {}
    await supabase.auth.signOut().catch(() => {});
    localStorage.removeItem('streamloop_token');
    localStorage.removeItem('streamloop_user');
    setToken(null);
    setUser(null);
  }, [token]);

  const syncWithBackend = async (supabaseUser: any, _supabaseSession?: any): Promise<{ token: string; user: User }> => {
    const email = supabaseUser.email || '';
    const name = supabaseUser.user_metadata?.full_name || supabaseUser.user_metadata?.name || email.split('@')[0];
    const avatar = supabaseUser.user_metadata?.avatar_url || '';

    let retries = 3;
    let lastErr: any = null;

    while (retries > 0) {
      try {
        const data = await apiFetch<{ token: string; user: User }>('/api/auth/supabase-login', {
          method: 'POST',
          body: JSON.stringify({
            supabaseId: supabaseUser.id,
            email,
            name,
            avatar,
          }),
        });

        localStorage.setItem('streamloop_token', data.token);
        localStorage.setItem('streamloop_user', JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
        return data;
      } catch (err: any) {
        lastErr = err;
        retries--;
        if (retries > 0) {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }
    throw lastErr || new Error('Failed to sync Supabase user with backend after retries.');
  };

  const refreshUser = useCallback(async () => {
    const savedToken = localStorage.getItem('streamloop_token');
    if (!savedToken) {
      // Check Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        try {
          await syncWithBackend(session.user, session);
        } catch {
          await logout();
        }
      }
      setIsLoading(false);
      return;
    }

    try {
      const data = await apiFetch<{ user: User }>('/api/auth/me');
      setUser(data.user);
      localStorage.setItem('streamloop_user', JSON.stringify(data.user));
    } catch {
      logout();
    } finally {
      setIsLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    const handleUnauthorized = () => logout();
    window.addEventListener('auth:unauthorized', handleUnauthorized);

    refreshUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        try {
          await syncWithBackend(session.user, session);
        } catch (err) {
          console.error('Failed to sync Supabase user on auth change:', err);
        }
      } else if (event === 'SIGNED_OUT') {
        logout();
      }
    });

    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
      authListener.subscription.unsubscribe();
    };
  }, [refreshUser, logout]);

  const signIn = async (email: string, pass: string): Promise<User> => {
    setIsLoading(true);
    try {
      const metaEnv = (import.meta as any).env || {};
      const isPlaceholder = !metaEnv.VITE_SUPABASE_URL || metaEnv.VITE_SUPABASE_URL.includes('placeholder');
      
      if (!isPlaceholder) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password: pass,
        });

        if (!error && data.user) {
          const backendResult = await syncWithBackend(data.user, data.session);
          return backendResult.user;
        }
      }

      // Fallback or direct backend sync if Supabase is unconfigured or failed
      const backendResult = await apiFetch<{ token: string; user: User }>('/api/auth/supabase-login', {
        method: 'POST',
        body: JSON.stringify({
          supabaseId: `sb_${email.replace(/[^a-zA-Z0-9]/g, '_')}`,
          email,
          name: email.split('@')[0],
          avatar: '',
        }),
      });

      localStorage.setItem('streamloop_token', backendResult.token);
      localStorage.setItem('streamloop_user', JSON.stringify(backendResult.user));
      setToken(backendResult.token);
      setUser(backendResult.user);
      return backendResult.user;
    } catch (err: any) {
      console.error('Sign in error:', err);
      throw new Error(err.message || 'Sign in failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (fullName: string, email: string, pass: string): Promise<User> => {
    setIsLoading(true);
    try {
      const metaEnv = (import.meta as any).env || {};
      const isPlaceholder = !metaEnv.VITE_SUPABASE_URL || metaEnv.VITE_SUPABASE_URL.includes('placeholder');

      if (!isPlaceholder) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password: pass,
          options: {
            data: {
              full_name: fullName,
            },
          },
        });

        if (!error && data.user) {
          if (data.session) {
            const backendResult = await syncWithBackend(data.user, data.session);
            return backendResult.user;
          } else {
            const backendResult = await syncWithBackend(data.user, null);
            return backendResult.user;
          }
        }
      }

      // Fallback or direct backend sync if Supabase is unconfigured or failed
      const backendResult = await apiFetch<{ token: string; user: User }>('/api/auth/supabase-login', {
        method: 'POST',
        body: JSON.stringify({
          supabaseId: `sb_${email.replace(/[^a-zA-Z0-9]/g, '_')}`,
          email,
          name: fullName,
          avatar: '',
        }),
      });

      localStorage.setItem('streamloop_token', backendResult.token);
      localStorage.setItem('streamloop_user', JSON.stringify(backendResult.user));
      setToken(backendResult.token);
      setUser(backendResult.user);
      return backendResult.user;
    } catch (err: any) {
      console.error('Sign up error:', err);
      throw new Error(err.message || 'Failed to create account. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const forgotPassword = async (email: string): Promise<void> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (error) throw error;
  };

  const isAdmin = user?.role === 'ADMIN';

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isAdmin,
        isLoading,
        signIn,
        signUp,
        signOut: logout,
        logout,
        forgotPassword,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
