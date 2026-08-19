import React, { useEffect, useState } from 'react';
import { Terminal, RefreshCw, Trash2 } from 'lucide-react';
import { apiFetch } from '../../lib/api.ts';
import { LogEntry } from '../../types/index.ts';

export const AdminLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const data = await apiFetch<{ logs: LogEntry[] }>('/api/stream/logs?limit=200');
      setLogs(data.logs);
    } catch (e) {
      console.error('Failed to fetch logs:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(() => fetchLogs(), 4000);
    return () => clearInterval(interval);
  }, []);

  const handleClear = async () => {
    await apiFetch('/api/stream/logs', { method: 'DELETE' });
    setLogs([]);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-white">Server & Stream Logs</h1>
            <span className="rounded-md bg-indigo-500/10 px-2 py-0.5 text-xs font-semibold text-indigo-400 border border-indigo-500/20">
              Live Console
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time stdout, stderr, and RTMP ingestion output from the streaming engine.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleClear}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-300 border border-slate-800 hover:bg-rose-950/40 hover:text-rose-300 transition-all cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Clear Log Buffer</span>
          </button>

          <button
            onClick={fetchLogs}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-300 border border-slate-800 hover:bg-slate-800 hover:text-white transition-all cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Terminal View */}
      <div className="rounded-3xl border border-slate-800/80 bg-[#070b13] p-5 shadow-2xl backdrop-blur-xl font-mono text-xs text-slate-300 space-y-2">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-emerald-400" />
            <span className="font-semibold text-white">FFmpeg Process Telemetry</span>
          </div>
          <span className="text-[11px] text-slate-500">{logs.length} entries</span>
        </div>

        <div className="h-[480px] max-h-[65vh] overflow-y-auto custom-scrollbar space-y-1.5 pt-2 text-[11px] leading-relaxed">
          {logs.length === 0 ? (
            <p className="text-slate-600 py-10 text-center">No log events recorded in memory.</p>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="flex items-start gap-2.5">
                <span className="text-slate-600 shrink-0 select-none">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span
                  className={`shrink-0 uppercase px-1 rounded text-[9px] font-bold ${
                    log.type === 'error'
                      ? 'bg-rose-500/20 text-rose-400'
                      : log.type === 'stderr'
                      ? 'bg-indigo-500/20 text-indigo-400'
                      : log.type === 'system'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {log.type}
                </span>
                <span
                  className={`break-all ${
                    log.type === 'error'
                      ? 'text-rose-300'
                      : log.type === 'stderr'
                      ? 'text-slate-300'
                      : log.type === 'system'
                      ? 'text-emerald-300 font-semibold'
                      : 'text-slate-400'
                  }`}
                >
                  {log.message}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
