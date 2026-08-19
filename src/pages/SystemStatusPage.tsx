import React, { useState, useEffect } from 'react';
import {
  Server,
  Cpu,
  HardDrive,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Terminal,
  Activity,
  Zap,
  Info,
  Clock,
  Layers
} from 'lucide-react';
import { SystemStatusInfo } from '../types/index.ts';
import { apiFetch } from '../lib/api.ts';

export const SystemStatusPage: React.FC = () => {
  const [status, setStatus] = useState<SystemStatusInfo | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      setError(null);
      const data = await apiFetch<SystemStatusInfo>('/api/system/status');
      setStatus(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch system metrics');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const formatBytes = (bytes?: number) => {
    if (!bytes) return '0 MB';
    const mb = bytes / (1024 * 1024);
    if (mb > 1024) {
      return `${(mb / 1024).toFixed(2)} GB`;
    }
    return `${mb.toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight sm:text-2xl">
            System Diagnostics & Engine Health
          </h1>
          <p className="text-xs text-slate-400">
            Real-time server infrastructure, FFmpeg/FFprobe binary verification, and host resources
          </p>
        </div>

        <button
          onClick={fetchStatus}
          disabled={isLoading}
          className="flex items-center gap-2 rounded-xl bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-200 border border-slate-700 hover:bg-slate-700 transition-all"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Metrics</span>
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 rounded-xl bg-rose-500/10 p-4 text-xs text-rose-400 border border-rose-500/30">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Binary Availability Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* FFmpeg Binary */}
        <div className="rounded-2xl border border-slate-800 bg-[#0d121f] p-5 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">FFmpeg Engine</span>
            {status?.ffmpegInstalled ? (
              <span className="flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-500/30">
                <CheckCircle2 className="h-3 w-3" />
                Installed
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs font-bold text-rose-400 bg-rose-950/40 px-2 py-0.5 rounded-full border border-rose-500/30">
                <AlertCircle className="h-3 w-3" />
                Missing
              </span>
            )}
          </div>
          <p className="text-base font-bold text-white">
            {status?.ffmpegInstalled ? '✓ Ready for 24×7 Stream' : 'Binary Not Found'}
          </p>
          <p className="text-[11px] font-mono text-slate-400 truncate" title={status?.ffmpegVersion || ''}>
            {status?.ffmpegVersion || 'Path: ' + (status?.ffmpegPath || 'ffmpeg')}
          </p>
        </div>

        {/* FFprobe Binary */}
        <div className="rounded-2xl border border-slate-800 bg-[#0d121f] p-5 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">FFprobe Analyzer</span>
            {status?.ffprobeInstalled ? (
              <span className="flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-500/30">
                <CheckCircle2 className="h-3 w-3" />
                Installed
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs font-bold text-rose-400 bg-rose-950/40 px-2 py-0.5 rounded-full border border-rose-500/30">
                <AlertCircle className="h-3 w-3" />
                Missing
              </span>
            )}
          </div>
          <p className="text-base font-bold text-white">
            {status?.ffprobeInstalled ? '✓ Metadata Extractor Ready' : 'Binary Not Found'}
          </p>
          <p className="text-[11px] font-mono text-slate-400 truncate" title={status?.ffprobeVersion || ''}>
            {status?.ffprobeVersion || 'Path: ' + (status?.ffprobePath || 'ffprobe')}
          </p>
        </div>

        {/* Streaming Engine Status */}
        <div className="rounded-2xl border border-slate-800 bg-[#0d121f] p-5 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Looping Subsystem</span>
            <span className="flex items-center gap-1 text-xs font-bold text-indigo-400 bg-indigo-950/40 px-2 py-0.5 rounded-full border border-indigo-500/30">
              <Zap className="h-3 w-3" />
              Active
            </span>
          </div>
          <p className="text-base font-bold text-white">
            Background Child Process
          </p>
          <p className="text-[11px] text-slate-400">
            PID: {status?.activeStreamPid || 'None (Standby)'}
          </p>
        </div>
      </div>

      {/* Host Metrics: CPU, RAM, Storage */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {/* CPU */}
        <div className="rounded-2xl border border-slate-800 bg-[#0d121f] p-6 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2 text-white text-sm font-bold">
              <Cpu className="h-4 w-4 text-violet-400" />
              <span>CPU Processor</span>
            </div>
            <span className="text-xs font-mono font-bold text-violet-400">
              {status?.cpu.usagePercent}%
            </span>
          </div>

          <div className="space-y-2">
            <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-all"
                style={{ width: `${status?.cpu.usagePercent || 5}%` }}
              />
            </div>
            <div className="text-[11px] text-slate-400 space-y-1">
              <p>Model: {status?.cpu.model}</p>
              <p>Cores: {status?.cpu.cores} CPU Thread(s)</p>
            </div>
          </div>
        </div>

        {/* RAM */}
        <div className="rounded-2xl border border-slate-800 bg-[#0d121f] p-6 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2 text-white text-sm font-bold">
              <Layers className="h-4 w-4 text-emerald-400" />
              <span>Host Memory (RAM)</span>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-400">
              {status?.memory.usedPercent}%
            </span>
          </div>

          <div className="space-y-2">
            <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all"
                style={{ width: `${status?.memory.usedPercent || 15}%` }}
              />
            </div>
            <div className="text-[11px] text-slate-400 space-y-1">
              <p>Used: {formatBytes(status?.memory.usedBytes)} / Total: {formatBytes(status?.memory.totalBytes)}</p>
              <p>Node Process RSS: {formatBytes(status?.processMemory.rss)}</p>
            </div>
          </div>
        </div>

        {/* Storage */}
        <div className="rounded-2xl border border-slate-800 bg-[#0d121f] p-6 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2 text-white text-sm font-bold">
              <HardDrive className="h-4 w-4 text-amber-400" />
              <span>Video Storage</span>
            </div>
            <span className="text-xs font-mono font-bold text-amber-400">
              {status?.storage.uploadsCount || 0} Files
            </span>
          </div>

          <div className="space-y-2">
            <p className="text-base font-bold text-white font-mono">
              {formatBytes(status?.storage.uploadsSizeBytes)} Used
            </p>
            <p className="text-[11px] text-slate-400">
              Dedicated storage directory at <span className="font-mono text-slate-300">./uploads</span>
            </p>
          </div>
        </div>
      </div>

      {/* OS & Environment Specs */}
      <div className="rounded-2xl border border-slate-800 bg-[#0d121f] p-6 shadow-lg space-y-4">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Server className="h-4 w-4 text-indigo-400" />
          Operating System & Runtime Platform
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="rounded-xl bg-slate-950 p-3 border border-slate-800/80">
            <span className="text-slate-400 text-[10px] uppercase">Platform / OS</span>
            <p className="font-semibold text-white mt-0.5">{status?.os.platform} ({status?.os.arch})</p>
          </div>

          <div className="rounded-xl bg-slate-950 p-3 border border-slate-800/80">
            <span className="text-slate-400 text-[10px] uppercase">OS Release</span>
            <p className="font-semibold text-white mt-0.5">{status?.os.release}</p>
          </div>

          <div className="rounded-xl bg-slate-950 p-3 border border-slate-800/80">
            <span className="text-slate-400 text-[10px] uppercase">Host Uptime</span>
            <p className="font-semibold text-white mt-0.5 font-mono">
              {status ? `${Math.floor(status.os.uptime / 3600)} hrs ${Math.floor((status.os.uptime % 3600) / 60)} mins` : 'N/A'}
            </p>
          </div>

          <div className="rounded-xl bg-slate-950 p-3 border border-slate-800/80">
            <span className="text-slate-400 text-[10px] uppercase">Server Timestamp</span>
            <p className="font-semibold text-white mt-0.5 font-mono">
              {status?.serverTime ? new Date(status.serverTime).toLocaleTimeString() : 'N/A'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
