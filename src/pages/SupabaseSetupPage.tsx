import React, { useState } from 'react';
import { Database, ShieldCheck, Key, Globe, CheckCircle2, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { apiFetch } from '../lib/api.ts';

interface SupabaseSetupPageProps {
  onConfigured: () => void;
}

export const SupabaseSetupPage: React.FC<SupabaseSetupPageProps> = ({ onConfigured }) => {
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTestConnection = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setTestResult(null);

    const cleanUrl = supabaseUrl.trim();
    const cleanKey = supabaseAnonKey.trim();

    if (!cleanUrl || !cleanUrl.startsWith('https://')) {
      setError('Please enter a valid Supabase Project URL starting with https://');
      return;
    }
    if (!cleanKey || cleanKey.length < 20) {
      setError('Please enter a valid Supabase Anon / Public Key.');
      return;
    }

    setIsTesting(true);
    try {
      const tempClient = createClient(cleanUrl, cleanKey);
      // Test connection by checking profiles or health
      const { error: pingError } = await tempClient.from('profiles').select('count', { count: 'exact', head: true });
      
      // If table doesn't exist yet but connection works, pingError code might be 'PGRST116' or '42P01', which means Supabase responded!
      if (pingError && pingError.code !== 'PGRST116' && pingError.code !== '42P01' && pingError.message && pingError.message.includes('JWT')) {
        throw new Error('Invalid Supabase Anon Key (JWT verification failed).');
      }

      setTestResult({
        success: true,
        message: '✓ Supabase connection successful! Database is reachable.',
      });
    } catch (err: any) {
      console.error('Supabase test error:', err);
      setTestResult({
        success: false,
        message: '✕ Unable to connect to Supabase. Please verify your Project URL and Anon Key.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanUrl = supabaseUrl.trim();
    const cleanKey = supabaseAnonKey.trim();

    if (!cleanUrl || !cleanKey) {
      setError('Both Supabase Project URL and Anon Key are required.');
      return;
    }

    setIsLoading(true);
    try {
      // Save configuration to backend
      await apiFetch('/api/supabase/config', {
        method: 'POST',
        body: JSON.stringify({
          supabaseUrl: cleanUrl,
          supabaseAnonKey: cleanKey,
        }),
      });

      // Save to localStorage for immediate client reactivity
      localStorage.setItem('streamloop_supabase_url', cleanUrl);
      localStorage.setItem('streamloop_supabase_key', cleanKey);

      onConfigured();
    } catch (err: any) {
      console.error('Failed to save configuration:', err);
      setError(err.message || 'Failed to save Supabase configuration.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#07090e] p-4 text-slate-100 selection:bg-indigo-500 selection:text-white">
      {/* Background ambient lighting */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-emerald-600/10 blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 h-[400px] w-[400px] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-lg space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-3">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-500 to-indigo-600 shadow-2xl shadow-emerald-500/20 ring-1 ring-emerald-400/30">
            <Database className="h-8 w-8 text-white" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-emerald-400 border border-emerald-500/30">
              <ShieldCheck className="h-3 w-3" />
              <span>Database Initialization</span>
            </div>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">
              Supabase Database Setup
            </h1>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
              Connect your Supabase project to power persistent authentication, user profiles, video libraries, and live stream settings.
            </p>
          </div>
        </div>

        {/* Configuration Card */}
        <div className="rounded-3xl border border-slate-800 bg-[#0d121f]/95 p-7 sm:p-8 shadow-2xl backdrop-blur-xl">
          <form onSubmit={handleSaveConfig} className="space-y-5">
            {error && (
              <div className="flex items-start gap-2.5 rounded-2xl bg-rose-500/10 p-3.5 text-left text-xs text-rose-300 border border-rose-500/30">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
                <span className="leading-snug">{error}</span>
              </div>
            )}

            {testResult && (
              <div className={`flex items-start gap-2.5 rounded-2xl p-3.5 text-left text-xs border ${
                testResult.success ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
              }`}>
                {testResult.success ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-400" /> : <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />}
                <span className="leading-snug">{testResult.message}</span>
              </div>
            )}

            <div className="space-y-4">
              {/* Project URL */}
              <div className="space-y-1.5 text-left">
                <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Supabase Project URL</span>
                </label>
                <input
                  type="url"
                  required
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                  placeholder="https://your-project-id.supabase.co"
                  className="w-full rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Anon Key */}
              <div className="space-y-1.5 text-left">
                <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Key className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Supabase Anon / Public Key</span>
                </label>
                <input
                  type="password"
                  required
                  value={supabaseAnonKey}
                  onChange={(e) => setSupabaseAnonKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  className="w-full rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-xs"
                />
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting || !supabaseUrl || !supabaseAnonKey}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3 text-xs font-bold text-white hover:bg-slate-700 transition-all disabled:opacity-50 cursor-pointer"
              >
                {isTesting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
                    <span>Testing Connection...</span>
                  </>
                ) : (
                  <span>Test Connection</span>
                )}
              </button>

              <button
                id="btn-save-supabase-config"
                type="submit"
                disabled={isLoading || !supabaseUrl || !supabaseAnonKey}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-indigo-600 px-4 py-3 text-xs font-bold text-white shadow-lg shadow-indigo-600/20 hover:from-emerald-500 hover:to-indigo-500 transition-all disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <span>Save Configuration</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>

            <div className="pt-3 border-t border-slate-800/80 text-[11px] text-slate-400 text-center">
              Find your Project URL and Anon Key in your <span className="text-emerald-400 font-semibold">Supabase Project Settings → API</span>.
            </div>
          </form>
        </div>

        <div className="text-center text-[11px] text-slate-500">
          StreamLoop 24×7 • Secure Supabase Database & Auth Integration
        </div>
      </div>
    </div>
  );
};
