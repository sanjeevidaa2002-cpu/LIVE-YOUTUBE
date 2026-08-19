import React, { useEffect, useState } from 'react';
import {
  Radio,
  Square,
  RefreshCw,
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  HardDrive,
  Film,
  Zap,
  Loader2,
} from 'lucide-react';
import { apiFetch } from '../../lib/api.ts';
import { AdminStreamItem } from '../../types/index.ts';

export const AdminStreamsPage: React.FC = () => {
  const [streams, setStreams] = useState<AdminStreamItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [stoppingUserId, setStoppingUserId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchStreams = async (quiet = false) => {
    if (!quiet) setIsLoading(true);
    try {
      const data = await apiFetch<{ streams: AdminStreamItem[] }>('/api/admin/streams');
      setStreams(data.streams);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to fetch active streams' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStreams();
    const interval = setInterval(() => fetchStreams(true), 5000);
    return () => clearInterval(interval);
  }, []);

  const handleStopStream = async (stream: AdminStreamItem) => {
    if (!confirm(`Are you sure you want to stop the active stream for ${stream.userEmail}?`)) {
      return;
    }
    setStoppingUserId(stream.userId);
    setFeedback(null);
    try {
      const res = await apiFetch<{ message: string }>(`/api/admin/streams/${stream.userId}/stop`, {
        method: 'POST',
      });
      setFeedback({ type: 'success', message: res.message || `Stream for ${stream.userEmail} was stopped.` });
      await fetchStreams(true);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to stop stream' });
    } finally {
      setStoppingUserId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-white">Live Stream Processes Monitor</h1>
            <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
              {streams.length} Active
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time multi-tenant RTMP streams running in background on the server.
          </p>
        </div>

        <button
          onClick={() => fetchStreams(false)}
          disabled={isLoading}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-300 border border-slate-800 hover:bg-slate-800 hover:text-white transition-all cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
          <span>Refresh Streams</span>
        </button>
      </div>

      {feedback && (
        <div
          className={`flex items-center justify-between rounded-2xl p-4 text-xs ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
          }`}
        >
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white font-bold ml-2">
            ×
          </button>
        </div>
      )}

      {streams.length === 0 ? (
        <div className="rounded-3xl border border-slate-800/80 bg-[#0d121f]/90 p-12 text-center shadow-2xl backdrop-blur-xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800/40 text-slate-500 mb-3 border border-slate-700/40">
            <Radio className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-white">No Streams Currently Active</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
            When users start a 24×7 YouTube live stream from their User Panel, the background FFmpeg process will appear here with live metrics.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {streams.map((stream) => (
            <div
              key={stream.userId}
              className="rounded-3xl border border-emerald-500/20 bg-slate-900/60 p-6 shadow-xl backdrop-blur-sm transition-all hover:border-emerald-500/40 space-y-4"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                {/* User details */}
                <div className="flex items-center gap-3">
                  {stream.userAvatar ? (
                    <img
                      src={stream.userAvatar}
                      alt={stream.userName}
                      referrerPolicy="no-referrer"
                      className="h-11 w-11 rounded-2xl object-cover ring-2 ring-emerald-500/30"
                    />
                  ) : (
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 font-bold text-sm ring-2 ring-emerald-500/30">
                      {stream.userName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-white text-sm">{stream.userName}</h3>
                      <span className="flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                        {stream.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 font-mono">{stream.userEmail}</p>
                  </div>
                </div>

                {/* Force Stop Button */}
                <button
                  type="button"
                  onClick={() => handleStopStream(stream)}
                  disabled={stoppingUserId === stream.userId}
                  className="inline-flex items-center gap-2 rounded-xl bg-rose-600/20 px-4 py-2 text-xs font-semibold text-rose-300 border border-rose-500/30 hover:bg-rose-600 hover:text-white transition-all cursor-pointer disabled:opacity-50"
                >
                  {stoppingUserId === stream.userId ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Square className="h-4 w-4 fill-current" />
                  )}
                  <span>Force Stop Stream</span>
                </button>
              </div>

              {/* Stream Specs Grid */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-2xl bg-slate-950/60 p-4 border border-slate-800/60 text-xs">
                <div>
                  <span className="text-slate-500 text-[11px] block">Process PID</span>
                  <span className="font-mono font-bold text-indigo-400">{stream.pid || 'Active'}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[11px] block">Uptime</span>
                  <span className="font-mono font-bold text-emerald-400">{stream.uptimeFormatted}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[11px] block">Current Video</span>
                  <span className="font-medium text-white truncate block">{stream.currentVideoName}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[11px] block">Encoding Stats</span>
                  <span className="font-mono text-slate-300">
                    {stream.realtimeStats?.fps ? `${stream.realtimeStats.fps} fps` : 'Syncing'} • {stream.realtimeStats?.bitrate || '4000k'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
