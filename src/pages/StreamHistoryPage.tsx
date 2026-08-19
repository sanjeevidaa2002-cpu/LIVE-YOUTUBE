import React, { useState, useEffect } from 'react';
import { History, Trash2, Clock, CheckCircle2, AlertCircle, RefreshCw, Radio, Film, Loader2 } from 'lucide-react';
import { StreamSession } from '../types/index.ts';
import { apiFetch } from '../lib/api.ts';

export const StreamHistoryPage: React.FC = () => {
  const [sessions, setSessions] = useState<StreamSession[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await apiFetch<{ sessions: StreamSession[] }>('/api/stream/history');
      setSessions(res.sessions || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load stream history');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleClear = async () => {
    if (!confirm('Are you sure you want to clear the entire stream history?')) return;
    try {
      await apiFetch('/api/stream/history', { method: 'DELETE' });
      setSessions([]);
    } catch (err: any) {
      alert(err.message || 'Failed to clear history');
    }
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return '0s';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}h ${mins}m ${secs}s`;
    }
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  const getStatusBadge = (status: StreamSession['status']) => {
    switch (status) {
      case 'SUCCESS':
      case 'STOPPED':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2.5 py-0.5 text-[11px] font-semibold text-slate-300 border border-slate-700">
            <CheckCircle2 className="h-3 w-3 text-emerald-400" />
            {status}
          </span>
        );
      case 'RECONNECTED':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-950/60 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-300 border border-indigo-800/40">
            <RefreshCw className="h-3 w-3 text-indigo-400" />
            RECONNECTED
          </span>
        );
      case 'CRASHED':
      case 'ERROR':
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-950/60 px-2.5 py-0.5 text-[11px] font-semibold text-rose-300 border border-rose-800/40">
            <AlertCircle className="h-3 w-3 text-rose-400" />
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight sm:text-2xl">
            Stream Broadcast History
          </h1>
          <p className="text-xs text-slate-400">
            Log of past 24×7 YouTube live streaming sessions, durations, and process exit statuses
          </p>
        </div>

        {sessions.length > 0 && (
          <button
            onClick={handleClear}
            className="flex items-center gap-2 rounded-xl bg-slate-800/80 px-3.5 py-2 text-xs font-semibold text-slate-300 border border-slate-700 hover:bg-rose-950/30 hover:text-rose-400 hover:border-rose-800/40 transition-all"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Clear History</span>
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 p-4 text-xs text-rose-400 border border-rose-500/30">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400 space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
          <p className="text-xs">Loading broadcast sessions...</p>
        </div>
      ) : sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-800 bg-[#0d121f] p-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600/10 text-indigo-400 mb-3 border border-indigo-500/20">
            <History className="h-7 w-7" />
          </div>
          <h2 className="text-base font-bold text-white">No Stream Sessions Yet</h2>
          <p className="max-w-md text-xs text-slate-400 mt-1">
            When you launch and broadcast streams to YouTube, historical session metrics will be preserved here.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0d121f] shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 bg-slate-900/60 uppercase text-slate-400 text-[10px] tracking-wider">
                <tr>
                  <th className="px-4 py-3">Video</th>
                  <th className="px-4 py-3">Started</th>
                  <th className="px-4 py-3">Stopped</th>
                  <th className="px-4 py-3">Broadcast Duration</th>
                  <th className="px-4 py-3">Reconnects</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {sessions.map((session) => (
                  <tr key={session.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 font-semibold text-white">
                      <div className="flex items-center gap-2">
                        <Film className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                        <span className="truncate max-w-xs">{session.videoName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {new Date(session.startedAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {session.stoppedAt ? new Date(session.stoppedAt).toLocaleString() : 'Running / Active'}
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold text-emerald-400">
                      {formatDuration(session.durationSeconds)}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-300">
                      {session.reconnectCount}
                    </td>
                    <td className="px-4 py-3">
                      {getStatusBadge(session.status)}
                    </td>
                    <td className="px-4 py-3 text-slate-400 max-w-xs truncate text-[11px]">
                      {session.errorMessage || 'Completed cleanly'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
