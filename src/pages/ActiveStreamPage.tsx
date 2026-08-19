import React from 'react';
import {
  Radio,
  Play,
  Square,
  RefreshCw,
  Clock,
  Film,
  Repeat,
  Cpu,
  Activity,
  AlertCircle,
  CheckCircle2,
  Sliders,
  Zap,
  ShieldCheck,
  ArrowRight,
  ListOrdered,
  Layers,
  ChevronRight,
  Monitor
} from 'lucide-react';
import { useStream } from '../context/StreamContext.tsx';
import { LiveBadge } from '../components/LiveBadge.tsx';
import { TerminalLogs } from '../components/TerminalLogs.tsx';
import { NavTab } from '../components/Sidebar.tsx';

interface ActiveStreamPageProps {
  onNavigate: (tab: NavTab) => void;
}

export const ActiveStreamPage: React.FC<ActiveStreamPageProps> = ({ onNavigate }) => {
  const { streamState, stopStream, restartStream, logs, clearLogs, isActionLoading } = useStream();

  const isLive = streamState?.status === 'LIVE' || streamState?.status === 'PLAYING_VIDEO' || streamState?.status === 'SWITCHING_VIDEO';
  const isStopped = streamState?.status === 'STOPPED' || streamState?.status === 'IDLE';
  const hasPlaylist = streamState?.playlist && streamState.playlist.length > 1;

  const formatDuration = (seconds: number) => {
    if (!seconds) return '00:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs}h ${mins}m ${secs}s`;
    }
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  };

  return (
    <div className="space-y-6">
      {/* Header with Title and Control Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight sm:text-2xl">
              Active Stream Monitor
            </h1>
            <p className="text-xs text-slate-400">
              Live server-side telemetry, playlist tracking, encoder controls, and real-time FFmpeg logs
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isLive ? (
            <>
              <button
                onClick={() => restartStream()}
                disabled={isActionLoading}
                className="flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 border border-slate-700 hover:bg-slate-700 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${isActionLoading ? 'animate-spin' : ''}`} />
                <span>Restart</span>
              </button>
              <button
                onClick={() => stopStream()}
                disabled={isActionLoading}
                className="flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-rose-600/30 hover:bg-rose-500 transition-all active:scale-95 disabled:opacity-50"
              >
                <Square className="h-4 w-4 fill-current" />
                <span>STOP STREAM</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => onNavigate('start-stream')}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition-all active:scale-95"
            >
              <Play className="h-4 w-4 fill-current" />
              <span>Configure & Start Stream</span>
            </button>
          )}
        </div>
      </div>

      {/* Big Live Hero Status Card */}
      <div
        className={`rounded-3xl border p-6 sm:p-8 shadow-2xl transition-all ${
          isLive
            ? 'border-emerald-500/30 bg-gradient-to-br from-[#0c1e18] via-[#0d1424] to-[#0a0f1d]'
            : streamState?.status === 'RECONNECTING'
            ? 'border-indigo-500/30 bg-gradient-to-br from-[#12162e] via-[#0d1424] to-[#0a0f1d]'
            : streamState?.status === 'ERROR'
            ? 'border-rose-500/30 bg-gradient-to-br from-[#230f14] via-[#0d1424] to-[#0a0f1d]'
            : 'border-slate-800 bg-[#0d121f]'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <LiveBadge status={streamState?.status} size="lg" />
              {streamState?.pid && (
                <span className="rounded-lg bg-slate-900/80 px-2.5 py-1 font-mono text-xs text-slate-300 border border-slate-700">
                  PID: {streamState.pid}
                </span>
              )}
              {hasPlaylist && (
                <span className="rounded-lg bg-indigo-500/20 px-2.5 py-1 text-xs font-semibold text-indigo-400 border border-indigo-500/30">
                  {streamState.playlist?.length} Video Playlist Sequence
                </span>
              )}
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {isLive
                ? hasPlaylist
                  ? `Now Playing [${(streamState?.currentIndex ?? 0) + 1}/${streamState?.playlist?.length}]: ${
                      streamState?.currentVideo?.originalName || streamState?.video?.originalName || 'Video'
                    }`
                  : `Looping: ${streamState?.video?.originalName || 'Video'}`
                : streamState?.status === 'RECONNECTING'
                ? 'Reconnecting to YouTube RTMP...'
                : streamState?.status === 'STARTING'
                ? 'Initializing FFmpeg Encoder on VPS...'
                : 'No Active Broadcast'}
            </h2>

            <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
              {streamState?.lastMessage ||
                (isStopped
                  ? 'The stream is currently stopped. Click below to begin 24x7 looping.'
                  : '')}
            </p>

            {streamState?.lastError && (
              <div className="flex items-center gap-2 rounded-xl bg-rose-500/20 p-3 text-xs text-rose-300 border border-rose-500/40">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>Error details: {streamState.lastError}</span>
              </div>
            )}
          </div>

          {/* Large Uptime & Loop Counter Display */}
          <div className="flex flex-wrap items-center gap-4 bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80">
            <div className="p-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Stream Uptime
              </span>
              <p className="font-mono text-2xl font-black text-white tracking-wider">
                {isLive ? streamState?.uptimeFormatted : '00:00:00'}
              </p>
              <span className="text-[10px] text-slate-400">
                Started:{' '}
                {streamState?.startedAt
                  ? new Date(streamState.startedAt).toLocaleTimeString()
                  : 'N/A'}
              </span>
            </div>

            <div className="h-12 w-px bg-slate-800 hidden sm:block" />

            <div className="p-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Loop Repetitions
              </span>
              <p className="text-2xl font-black text-indigo-400">
                #{isLive ? streamState?.currentLoop : 0}
              </p>
              <span className="text-[10px] text-slate-400">Continuous 24×7</span>
            </div>
          </div>
        </div>

        {/* Multi-Video Playlist Interactive Tracker */}
        {isLive && hasPlaylist && streamState?.playlist && (
          <div className="mt-6 pt-6 border-t border-slate-800/80 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ListOrdered className="h-4 w-4 text-indigo-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Live Playlist Timeline
                </span>
              </div>
              <span className="text-xs text-indigo-300">
                Full Loop Duration: {formatDuration(streamState.totalDurationSeconds || 0)}
              </span>
            </div>

            {/* Step-by-Step Video Badges */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {streamState.playlist.map((item, idx) => {
                const isCurrent = (streamState.currentIndex ?? 0) === idx;
                const isPast = (streamState.currentIndex ?? 0) > idx;

                return (
                  <div
                    key={`pl_mon_${item.id}_${idx}`}
                    className={`flex items-center gap-2.5 rounded-xl border p-2.5 transition-all ${
                      isCurrent
                        ? 'border-emerald-500/50 bg-emerald-950/40 ring-1 ring-emerald-500/50'
                        : isPast
                        ? 'border-slate-800 bg-slate-900/40 opacity-75'
                        : 'border-slate-800/60 bg-slate-900/20 opacity-60'
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                        isCurrent
                          ? 'bg-emerald-500 text-slate-950 animate-pulse'
                          : isPast
                          ? 'bg-slate-800 text-emerald-400'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {isPast ? '✓' : `#${idx + 1}`}
                    </span>

                    <div className="flex-1 min-w-0">
                      <p className={`truncate text-xs font-semibold ${isCurrent ? 'text-emerald-300' : 'text-white'}`}>
                        {item.originalName}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {isCurrent ? `${streamState.currentVideoProgressPercent}% playing` : formatDuration(item.duration || 0)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Current Video Progress Bar */}
            <div className="space-y-1.5 pt-2">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-slate-300 font-medium">
                  <Play className="h-3 w-3 text-emerald-400 fill-current" />
                  Active Video Progress ({streamState.currentVideo?.originalName})
                </span>
                <span className="font-mono text-emerald-300">
                  {streamState.currentVideoProgressPercent}% ({formatDuration(streamState.currentVideoElapsedSeconds || 0)} /{' '}
                  {formatDuration(streamState.currentVideo?.duration || 0)})
                </span>
              </div>
              <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500 rounded-full"
                  style={{ width: `${streamState.currentVideoProgressPercent}%` }}
                />
              </div>
            </div>

            {/* Overall Playlist Loop Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-slate-400 font-medium">
                  <Repeat className="h-3 w-3 text-indigo-400" />
                  Full Playlist Loop #{streamState.currentLoop}
                </span>
                <span className="font-mono text-indigo-300">{streamState.loopProgressPercent}%</span>
              </div>
              <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500 rounded-full"
                  style={{ width: `${streamState.loopProgressPercent}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Single Video Progress Bar (when not a playlist) */}
        {isLive && !hasPlaylist && streamState?.video && (
          <div className="mt-6 pt-6 border-t border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-slate-300 font-medium">
                <Repeat className="h-3.5 w-3.5 text-indigo-400" />
                Current Loop Progress (Iteration #{streamState.currentLoop})
              </span>
              <span className="font-mono text-slate-400">
                {streamState.loopProgressPercent}% of {Math.round(streamState.video.duration)}s video
              </span>
            </div>
            <div className="h-2.5 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 via-violet-500 to-emerald-400 transition-all duration-500 rounded-full"
                style={{ width: `${streamState.loopProgressPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Real-time Telemetry Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-2xl border border-slate-800 bg-[#0d121f] p-4 text-center">
          <span className="text-[10px] uppercase font-semibold text-slate-400">Real-Time FPS</span>
          <p className="mt-1 font-mono text-xl font-bold text-emerald-400">
            {isLive ? streamState?.realtimeStats.fps : '0.0'}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#0d121f] p-4 text-center">
          <span className="text-[10px] uppercase font-semibold text-slate-400">Live Bitrate</span>
          <p className="mt-1 font-mono text-xl font-bold text-indigo-400">
            {isLive ? streamState?.realtimeStats.bitrate : '0 kbps'}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#0d121f] p-4 text-center">
          <span className="text-[10px] uppercase font-semibold text-slate-400">Frames Rendered</span>
          <p className="mt-1 font-mono text-xl font-bold text-white">
            {isLive ? streamState?.realtimeStats.frame.toLocaleString() : '0'}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#0d121f] p-4 text-center">
          <span className="text-[10px] uppercase font-semibold text-slate-400">Encoding Speed</span>
          <p className="mt-1 font-mono text-xl font-bold text-amber-400">
            {isLive ? streamState?.realtimeStats.speed : '0x'}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#0d121f] p-4 text-center">
          <span className="text-[10px] uppercase font-semibold text-slate-400">Reconnect Count</span>
          <p className="mt-1 font-mono text-xl font-bold text-violet-400">
            {streamState?.reconnectCount || 0}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#0d121f] p-4 text-center">
          <span className="text-[10px] uppercase font-semibold text-slate-400">Output Target</span>
          <p className="mt-1 text-sm font-bold text-rose-400 truncate">YouTube Live</p>
        </div>
      </div>

      {/* Full Live FFmpeg Terminal Stream */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-white">Live FFmpeg Process Terminal</h2>
            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
              STREAMING STDIN/STDOUT
            </span>
          </div>
        </div>
        <TerminalLogs logs={logs} onClearLogs={clearLogs} maxHeight="max-h-[480px]" />
      </div>

      {/* Broadcast Tips & Reliability Assurance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-slate-800 bg-[#0d121f] p-5 shadow-lg space-y-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-indigo-400" />
            24×7 Background Persistence
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            Your live stream is being pushed by a detached server-side FFmpeg process on the VPS machine.
            You can safely close this browser, shut down your computer, or leave the site — the stream continues running 24×7.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#0d121f] p-5 shadow-lg space-y-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Zap className="h-4 w-4 text-emerald-400" />
            Continuous Multi-Video Concat Demuxer
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            StreamLoop uses a low-overhead FFmpeg concat demuxer with standardized 1080p/720p scaling and audio normalization so all sequential video switches happen without any stream interruption or buffering on YouTube.
          </p>
        </div>
      </div>
    </div>
  );
};
