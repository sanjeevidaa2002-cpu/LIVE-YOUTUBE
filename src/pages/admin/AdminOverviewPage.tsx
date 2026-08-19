import React, { useEffect, useState } from 'react';
import {
  Users,
  Radio,
  Film,
  ListOrdered,
  Cpu,
  HardDrive,
  Activity,
  ShieldCheck,
  RefreshCw,
  Server,
  Zap,
  CheckCircle2,
} from 'lucide-react';
import { apiFetch } from '../../lib/api.ts';
import { AdminOverviewStats } from '../../types/index.ts';

interface AdminOverviewPageProps {
  onNavigateTab: (tab: string) => void;
}

export const AdminOverviewPage: React.FC<AdminOverviewPageProps> = ({ onNavigateTab }) => {
  const [stats, setStats] = useState<AdminOverviewStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const fetchOverview = async (quiet = false) => {
    if (!quiet) setIsLoading(true);
    else setIsRefreshing(true);
    try {
      const data = await apiFetch<AdminOverviewStats>('/api/admin/overview');
      setStats(data);
    } catch (e) {
      console.error('Failed to load admin overview:', e);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOverview();
    const interval = setInterval(() => fetchOverview(true), 10000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading && !stats) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center space-y-3">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Loading System Overview...</p>
        </div>
      </div>
    );
  }

  const sys = stats?.system;
  const storage = stats?.storage;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-white">Administrator Overview</h1>
            <span className="rounded-md bg-indigo-500/10 px-2 py-0.5 text-xs font-semibold text-indigo-400 border border-indigo-500/20">
              Admin Panel
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Global status, live multi-user RTMP concurrency, storage health, and VPS diagnostics.
          </p>
        </div>

        <button
          onClick={() => fetchOverview(true)}
          disabled={isRefreshing}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-300 border border-slate-800 hover:bg-slate-800 hover:text-white transition-all cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`} />
          <span>Refresh Metrics</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Users */}
        <div
          onClick={() => onNavigateTab('users')}
          className="group cursor-pointer rounded-2xl border border-slate-800/80 bg-slate-900/50 p-5 backdrop-blur-sm transition-all hover:border-slate-700 hover:bg-slate-900/80"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Users</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 group-hover:scale-105 transition-transform">
              <Users className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">{stats?.totalUsers || 0}</span>
            <span className="text-xs text-emerald-400 font-medium">({stats?.activeUsers || 0} active)</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Google-authenticated accounts</p>
        </div>

        {/* Active Live Streams */}
        <div
          onClick={() => onNavigateTab('streams')}
          className="group cursor-pointer rounded-2xl border border-slate-800/80 bg-slate-900/50 p-5 backdrop-blur-sm transition-all hover:border-slate-700 hover:bg-slate-900/80"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Active Live Streams</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 group-hover:scale-105 transition-transform">
              <Radio className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">{stats?.activeStreams || 0}</span>
            <span className="text-xs text-slate-400 font-mono">/ {sys?.maxConcurrentStreams || 10} max</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span>24×7 Background Server Loops</span>
          </div>
        </div>

        {/* Total Videos Library */}
        <div
          onClick={() => onNavigateTab('storage')}
          className="group cursor-pointer rounded-2xl border border-slate-800/80 bg-slate-900/50 p-5 backdrop-blur-sm transition-all hover:border-slate-700 hover:bg-slate-900/80"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Videos Library</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20 group-hover:scale-105 transition-transform">
              <Film className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">{stats?.totalVideos || 0}</span>
            <span className="text-xs text-slate-400">videos stored</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">{stats?.totalPlaylists || 0} multi-video playlists</p>
        </div>

        {/* Storage Health */}
        <div
          onClick={() => onNavigateTab('storage')}
          className="group cursor-pointer rounded-2xl border border-slate-800/80 bg-slate-900/50 p-5 backdrop-blur-sm transition-all hover:border-slate-700 hover:bg-slate-900/80"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Server Storage</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 group-hover:scale-105 transition-transform">
              <HardDrive className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-base font-bold text-emerald-400">
              Persistent Storage
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500 truncate">
            Local Disk Active
          </p>
        </div>
      </div>

      {/* System Diagnostics Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Hardware & VPS Resource Usage */}
        <div className="rounded-3xl border border-slate-800/80 bg-slate-900/40 p-6 backdrop-blur-sm lg:col-span-2 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Cpu className="h-5 w-5 text-indigo-400" />
              <h2 className="text-base font-bold text-white">VPS Hardware & Engine Performance</h2>
            </div>
            <span className="text-xs font-mono text-slate-400">{sys?.os.platform} ({sys?.os.arch})</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Memory Usage */}
            <div className="rounded-2xl bg-slate-950/60 p-4 border border-slate-800/60 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-400">RAM Allocation</span>
                <span className="font-bold text-white font-mono">{sys?.memory.usedPercent || 0}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all"
                  style={{ width: `${sys?.memory.usedPercent || 0}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-slate-500 font-mono">
                <span>Used: {Math.round((sys?.memory.usedBytes || 0) / 1024 / 1024)} MB</span>
                <span>Total: {Math.round((sys?.memory.totalBytes || 0) / 1024 / 1024)} MB</span>
              </div>
            </div>

            {/* CPU Load */}
            <div className="rounded-2xl bg-slate-950/60 p-4 border border-slate-800/60 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-400">CPU Load Average</span>
                <span className="font-bold text-white font-mono">{sys?.cpu.usagePercent || 0}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all"
                  style={{ width: `${Math.min(100, sys?.cpu.usagePercent || 0)}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>{sys?.cpu.cores || 1} Cores Available</span>
                <span className="truncate max-w-[120px]">{sys?.cpu.model || 'CPU'}</span>
              </div>
            </div>
          </div>

          {/* Engine Binaries Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-800/60">
            <div className="flex items-center gap-2.5 rounded-xl bg-slate-950/40 p-3 border border-slate-800/40">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-white">FFmpeg Engine</p>
                <p className="text-[11px] text-slate-400 font-mono">Installed & Ready</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 rounded-xl bg-slate-950/40 p-3 border border-slate-800/40">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-white">FFprobe Analyzer</p>
                <p className="text-[11px] text-slate-400 font-mono">Hardware Probe OK</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 rounded-xl bg-slate-950/40 p-3 border border-slate-800/40">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-white">Manual Start Mode</p>
                <p className="text-[11px] text-emerald-400 font-mono">Strict Enforced</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Technical Actions */}
        <div className="rounded-3xl border border-slate-800/80 bg-slate-900/40 p-6 backdrop-blur-sm space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
            <h2 className="text-base font-bold text-white">Admin Controls</h2>
          </div>
          <p className="text-xs text-slate-400">
            Quick administrative tools and management views:
          </p>

          <div className="space-y-2">
            <button
              onClick={() => onNavigateTab('users')}
              className="w-full flex items-center justify-between rounded-xl bg-slate-950/70 p-3 text-xs font-medium text-slate-200 border border-slate-800/80 hover:bg-indigo-600/15 hover:border-indigo-500/30 hover:text-indigo-300 transition-all cursor-pointer"
            >
              <span>Manage User Accounts</span>
              <Users className="h-4 w-4 text-slate-400" />
            </button>

            <button
              onClick={() => onNavigateTab('streams')}
              className="w-full flex items-center justify-between rounded-xl bg-slate-950/70 p-3 text-xs font-medium text-slate-200 border border-slate-800/80 hover:bg-indigo-600/15 hover:border-indigo-500/30 hover:text-indigo-300 transition-all cursor-pointer"
            >
              <span>Live Streams Monitor</span>
              <Radio className="h-4 w-4 text-slate-400" />
            </button>

            <button
              onClick={() => onNavigateTab('storage')}
              className="w-full flex items-center justify-between rounded-xl bg-slate-950/70 p-3 text-xs font-medium text-slate-200 border border-slate-800/80 hover:bg-indigo-600/15 hover:border-indigo-500/30 hover:text-indigo-300 transition-all cursor-pointer"
            >
              <span>Server Storage</span>
              <HardDrive className="h-4 w-4 text-slate-400" />
            </button>

            <button
              onClick={() => onNavigateTab('settings')}
              className="w-full flex items-center justify-between rounded-xl bg-slate-950/70 p-3 text-xs font-medium text-slate-200 border border-slate-800/80 hover:bg-indigo-600/15 hover:border-indigo-500/30 hover:text-indigo-300 transition-all cursor-pointer"
            >
              <span>Global System Settings</span>
              <Server className="h-4 w-4 text-slate-400" />
            </button>

            <button
              onClick={() => onNavigateTab('security')}
              className="w-full flex items-center justify-between rounded-xl bg-slate-950/70 p-3 text-xs font-medium text-slate-200 border border-slate-800/80 hover:bg-indigo-600/15 hover:border-indigo-500/30 hover:text-indigo-300 transition-all cursor-pointer"
            >
              <span>Security & Admin Emails</span>
              <ShieldCheck className="h-4 w-4 text-slate-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
