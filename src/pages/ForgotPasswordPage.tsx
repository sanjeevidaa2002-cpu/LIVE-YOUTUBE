import React, { useState } from 'react';
import { Tv, ShieldCheck, Mail, AlertCircle, Loader2, CheckCircle2, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';

interface ForgotPasswordPageProps {
  onBackToLogin: () => void;
}

export const ForgotPasswordPage: React.FC<ForgotPasswordPageProps> = ({ onBackToLogin }) => {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);
    try {
      await forgotPassword(cleanEmail);
      setSuccessMessage('Password reset instructions have been sent to your email.');
    } catch (err: any) {
      console.error('Password reset error:', err);
      setError(err.message || 'Failed to send password reset email. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#080B12] p-4 text-slate-100 selection:bg-indigo-500 selection:text-white">
      {/* Background radial ambient lights */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-indigo-600/15 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 h-[400px] w-[400px] rounded-full bg-violet-600/10 blur-[100px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md space-y-6">
        {/* Branding */}
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 shadow-xl shadow-indigo-600/30 ring-1 ring-white/20">
            <Tv className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
            StreamLoop <span className="text-indigo-400">24×7</span>
          </h1>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            Autonomous YouTube RTMP Live Stream Engine with Server Storage
          </p>
        </div>

        {/* Card */}
        <div className="rounded-3xl border border-slate-800 bg-[#0d121f]/90 p-8 shadow-2xl backdrop-blur-xl">
          <form onSubmit={handleSubmit} className="space-y-5 text-center">
            <div className="space-y-1 text-left">
              <h2 className="text-lg font-bold text-white">Reset Password</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Enter your account email address and we will send you a secure link to reset your password.
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-2.5 rounded-2xl bg-rose-500/10 p-3.5 text-left text-xs text-rose-300 border border-rose-500/30">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
                <span className="leading-snug">{error}</span>
              </div>
            )}

            {successMessage && (
              <div className="flex items-start gap-2.5 rounded-2xl bg-emerald-500/10 p-3.5 text-left text-xs text-emerald-300 border border-emerald-500/30">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-400" />
                <span className="leading-snug">{successMessage}</span>
              </div>
            )}

            <div className="space-y-4 text-left">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Email Address</label>
                <div className="relative flex items-center">
                  <Mail className="absolute left-3.5 h-4 w-4 text-slate-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-xl border border-slate-800 bg-slate-900/80 pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            <button
              id="btn-reset-submit"
              type="submit"
              disabled={isLoading}
              className="group relative flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-3.5 text-sm font-bold text-white shadow-xl shadow-indigo-600/20 hover:from-indigo-500 hover:to-violet-500 transition-all active:scale-[0.98] disabled:opacity-60 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin text-white" />
                  <span>Sending Reset Link...</span>
                </>
              ) : (
                <span>Send Password Reset Email</span>
              )}
            </button>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={onBackToLogin}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white cursor-pointer transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back to Sign In</span>
              </button>
            </div>
          </form>
        </div>

        {/* Security footer */}
        <div className="flex items-center justify-center gap-2 text-center text-[11px] text-slate-500">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400/80" />
          <span>Supabase Secure Authentication</span>
        </div>
      </div>
    </div>
  );
};
