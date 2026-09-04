import React, { useEffect, useState } from 'react';
import {
  Server,
  Cpu,
  HardDrive,
  Activity,
  CheckCircle2,
  RefreshCw,
  Clock,
  Terminal,
  Shield,
  Layers,
} from 'lucide-react';
import { apiFetch } from '../../lib/api.ts';
import { SystemStatusInfo } from '../../types/index.ts';

export const AdminSystemPage: React.FC = () => {
  const [systemInfo, setSystemInfo] = useState<SystemStatusInfo | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchSystem = async (quiet = false) => {
    if (!quiet) setIsLoading(true);
    try {
      const data = await apiFetch<{ system: SystemStatusInfo }>('/api/admin/system');
      if (data?.system) {
        setSystemInfo(data.system);
      }
    } catch (err) {
      console.error('Failed to fetch system diagnostics:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSystem();
    const interval = setInterval(() => fetchSystem(true), 12000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-white">VPS System Diagnostics</h1>
            <span className="rounded-md bg-indigo-500/10 px-2 py-0.5 text-xs font-semibold text-indigo-400 border border-indigo-500/20">
              Low-Level Engine Diagnostics
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Hardware resources, binary paths, system uptime, and multi-process state.
          </p>
        </div>

        <button
          onClick={() => fetchSystem()}
          disabled={isLoading}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-300 border border-slate-800 hover:bg-slate-800 hover:text-white transition-all cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
          <span>Refresh Diagnostics</span>
        </button>
      </div>

      {/* Binaries & Engine Health */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-3xl border border-slate-800/80 bg-[#0d121f]/90 p-5 shadow-xl backdrop-blur-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">FFmpeg Streaming Binary</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="text-sm font-bold text-white">Installed & Operational</p>
          <p className="text-[11px] font-mono text-slate-500 truncate">{systemInfo?.ffmpegPath || 'ffmpeg'}</p>
        </div>

        <div className="rounded-3xl border border-slate-800/80 bg-[#0d121f]/90 p-5 shadow-xl backdrop-blur-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">FFprobe Media Probe</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="text-sm font-bold text-white">Hardware Analyzer Ready</p>
          <p className="text-[11px] font-mono text-slate-500 truncate">{systemInfo?.ffprobePath || 'ffprobe'}</p>
        </div>

        <div className="rounded-3xl border border-slate-800/80 bg-[#0d121f]/90 p-5 shadow-xl backdrop-blur-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Concurrency Load</span>
            <Activity className="h-4 w-4 text-indigo-400" />
          </div>
          <p className="text-sm font-bold text-white">
            {systemInfo?.activeStreamsCount || 0} / {systemInfo?.maxConcurrentStreams || 10} Streams
          </p>
          <p className="text-[11px] text-slate-500">Autonomous Server Processes</p>
        </div>
      </div>

      {/* Hardware Deep Dive */}
      <div className="rounded-3xl border border-slate-800/80 bg-[#0d121f]/90 p-6 shadow-2xl backdrop-blur-xl space-y-6">
        <div className="flex items-center gap-2">
          <Cpu className="h-5 w-5 text-indigo-400" />
          <h2 className="text-base font-bold text-white">Hardware Resources Allocation</h2>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {/* Memory */}
          <div className="rounded-2xl bg-slate-950/60 p-5 border border-slate-800/60 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white">System Memory (RAM)</span>
              <span className="text-xs font-mono font-bold text-indigo-400">{systemInfo?.memory.usedPercent || 0}% Used</span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full"
                style={{ width: `${systemInfo?.memory.usedPercent || 0}%` }}
              />
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 font-mono">
              <div>Total: {Math.round((systemInfo?.memory.totalBytes || 0) / 1024 / 1024)} MB</div>
              <div>Free: {Math.round((systemInfo?.memory.freeBytes || 0) / 1024 / 1024)} MB</div>
              <div>Process RSS: {Math.round((systemInfo?.processMemory.rss || 0) / 1024 / 1024)} MB</div>
              <div>Heap: {Math.round((systemInfo?.processMemory.heapUsed || 0) / 1024 / 1024)} MB</div>
            </div>
          </div>

          {/* OS Environment */}
          <div className="rounded-2xl bg-slate-950/60 p-5 border border-slate-800/60 space-y-3 text-xs">
            <span className="font-semibold text-white block">Host Environment</span>
            <div className="space-y-2 text-slate-300">
              <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                <span className="text-slate-400">Operating System:</span>
                <span className="font-mono text-white">{systemInfo?.os.platform} ({systemInfo?.os.arch})</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                <span className="text-slate-400">Kernel Release:</span>
                <span className="font-mono text-white">{systemInfo?.os.release}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                <span className="text-slate-400">Node.js Runtime:</span>
                <span className="font-mono text-emerald-400">{process.version}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Server Time:</span>
                <span className="font-mono text-slate-400">{systemInfo?.serverTime}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
