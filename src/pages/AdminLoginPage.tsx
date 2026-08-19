import React, { useState } from 'react';
import { ShieldCheck, Lock, AlertTriangle, Loader2, KeyRound, ArrowRight, CheckCircle2, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { User } from '../types/index.ts';

interface AdminLoginPageProps {
  onAdminAuthenticated: (user: User, token: string) => void;
}

export const AdminLoginPage: React.FC<AdminLoginPageProps> = ({ onAdminAuthenticated }) => {
  const { signIn, user, token } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdminSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const loggedUser = await signIn(email, password);
      if (loggedUser.role !== 'ADMIN') {
        throw new Error('Access denied: You are not authorized as the administrator.');
      }
      const currentToken = localStorage.getItem('streamloop_token') || '';
      onAdminAuthenticated(loggedUser, currentToken);
    } catch (err: any) {
      console.error('[Admin Login Error]:', err);
      setError(err.message || 'Access Denied: Invalid credentials or unauthorized admin identity.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#07090e] p-4 text-slate-100 selection:bg-amber-500 selection:text-black">
      {/* Dark Ambient Backlighting */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[450px] w-[450px] rounded-full bg-amber-500/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 h-[350px] w-[350px] rounded-full bg-indigo-600/10 blur-[110px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md space-y-6">
        {/* Security Header Badge */}
        <div className="text-center space-y-3">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-indigo-600 shadow-2xl shadow-amber-500/20 ring-1 ring-amber-400/30">
            <ShieldCheck className="h-8 w-8 text-white" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-amber-400 border border-amber-500/30">
              <Lock className="h-3 w-3" />
              <span>Restricted System Gateway</span>
            </div>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">
              Administrator Access
            </h1>
            <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1">
              StreamLoop VPS & Fleet Management Control Panel
            </p>
          </div>
        </div>

        {/* Security Login Card */}
        <div className="rounded-3xl border border-amber-500/20 bg-[#0c101b]/95 p-7 sm:p-8 shadow-2xl backdrop-blur-xl">
          <form onSubmit={handleAdminSignIn} className="space-y-5 text-center">
            <div className="space-y-1.5 text-left">
              <h2 className="text-base font-bold text-white">Admin Authentication</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Log in with your authorized administrator Supabase credentials (<strong className="text-amber-300">Light Gaming 4M</strong>).
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-2.5 rounded-2xl bg-rose-500/15 p-4 text-left text-xs text-rose-200 border border-rose-500/40">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
                <div className="space-y-1">
                  <p className="font-bold text-rose-300">Authorization Failed</p>
                  <p className="leading-snug text-[11px] text-rose-200/90">{error}</p>
                </div>
              </div>
            )}

            <div className="space-y-4 text-left">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Admin Email</label>
                <div className="relative flex items-center">
                  <Mail className="absolute left-3.5 h-4 w-4 text-slate-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@streamloop.io"
                    className="w-full rounded-xl border border-slate-800 bg-slate-900/80 pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Password</label>
                <div className="relative flex items-center">
                  <KeyRound className="absolute left-3.5 h-4 w-4 text-slate-500" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-slate-800 bg-slate-900/80 pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>
            </div>

            <button
              id="btn-admin-signin"
              type="submit"
              disabled={isLoading}
              className="group relative flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 px-5 py-3.5 text-sm font-bold text-black shadow-xl shadow-amber-500/20 hover:from-amber-400 hover:to-amber-500 transition-all active:scale-[0.98] disabled:opacity-60 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin text-black" />
                  <span>Verifying Admin Credentials...</span>
                </>
              ) : (
                <>
                  <span>Authenticate Admin</span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-black/70 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>

            {/* Security Notice */}
            <div className="pt-3 border-t border-slate-800/80 space-y-2 text-left text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                <span className="text-[11px]">Strict server-side identity verification</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                <span className="text-[11px]">Direct control over VPS FFmpeg processes & streams</span>
              </div>
            </div>
          </form>
        </div>

        {/* Footer info */}
        <div className="text-center text-[11px] text-slate-600">
          StreamLoop Fleet Security • Supabase Auth • FFmpeg Core
        </div>
      </div>
    </div>
  );
};
