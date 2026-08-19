import React, { useState } from 'react';
import { Tv, ShieldCheck, Mail, Lock, User as UserIcon, AlertCircle, Loader2, CheckCircle2, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';

interface SignUpPageProps {
  onSwitchToLogin: () => void;
}

export const SignUpPage: React.FC<SignUpPageProps> = ({ onSwitchToLogin }) => {
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const cleanName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName) {
      setError('Full name is required.');
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      await signUp(cleanName, cleanEmail, password);
      setSuccessMessage('Account created successfully! Redirecting to dashboard...');
    } catch (err: any) {
      console.error('Sign up error:', err);
      setError(err.message || 'Failed to create account. Please try again.');
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

        {/* Register Card */}
        <div className="rounded-3xl border border-slate-800 bg-[#0d121f]/90 p-8 shadow-2xl backdrop-blur-xl">
          <form onSubmit={handleSignUp} className="space-y-5 text-center">
            <div className="space-y-1 text-left">
              <h2 className="text-lg font-bold text-white">Create Your Account</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Set up your Supabase account to manage 24×7 live streams and video libraries.
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
              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Full Name</label>
                <div className="relative flex items-center">
                  <UserIcon className="absolute left-3.5 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Light Gaming"
                    className="w-full rounded-xl border border-slate-800 bg-slate-900/80 pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Email */}
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

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Password</label>
                <div className="relative flex items-center">
                  <Lock className="absolute left-3.5 h-4 w-4 text-slate-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-slate-800 bg-slate-900/80 pl-10 pr-12 py-3 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 text-xs font-medium text-slate-400 hover:text-white cursor-pointer"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Confirm Password</label>
                <div className="relative flex items-center">
                  <Lock className="absolute left-3.5 h-4 w-4 text-slate-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-slate-800 bg-slate-900/80 pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button
              id="btn-signup-submit"
              type="submit"
              disabled={isLoading}
              className="group relative flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-3.5 text-sm font-bold text-white shadow-xl shadow-indigo-600/20 hover:from-indigo-500 hover:to-violet-500 transition-all active:scale-[0.98] disabled:opacity-60 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin text-white" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>

            {/* Switch to login */}
            <div className="pt-2 text-center text-xs text-slate-400">
              Already have an account?{' '}
              <button
                type="button"
                onClick={onSwitchToLogin}
                className="font-semibold text-indigo-400 hover:text-indigo-300 hover:underline cursor-pointer"
              >
                Sign In
              </button>
            </div>
          </form>
        </div>

        {/* Security footer */}
        <div className="flex items-center justify-center gap-2 text-center text-[11px] text-slate-500">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400/80" />
          <span>Supabase Secure Authentication • RLS Protected</span>
        </div>
      </div>
    </div>
  );
};
