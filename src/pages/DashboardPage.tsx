import React, { useState } from 'react';
import {
  Radio,
  Film,
  Clock,
  Youtube,
  Cpu,
  Repeat,
  Play,
  Square,
  RefreshCw,
  ArrowRight,
  Activity,
  Zap,
  CheckCircle2,
  HardDrive,
  UploadCloud
} from 'lucide-react';
import { useStream } from '../context/StreamContext.tsx';
import { LiveBadge } from '../components/LiveBadge.tsx';
import { TerminalLogs } from '../components/TerminalLogs.tsx';
import { VideoUploadModal } from '../components/VideoUploadModal.tsx';
import { NavTab } from '../components/Sidebar.tsx';
import { VideoMetadata } from '../types/index.ts';

interface DashboardPageProps {
  onNavigate: (tab: NavTab) => void;
  onOpenUpload: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onNavigate,
  onOpenUpload,
}) => {
  const { streamState, stopStream, restartStream, logs, clearLogs, isActionLoading } = useStream();

  const isLive = streamState?.status === 'LIVE';
  const isStarting = streamState?.status === 'STARTING';
  const isStopping = streamState?.status === 'STOPPING';

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '0 MB';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* Hero Quick Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-r from-slate-900 via-[#0d1222] to-slate-900 p-6 sm:p-8 shadow-2xl">
        <div className="absolute right-0 top-0 -mt-8 -mr-8 h-64 w-64 rounded-full bg-indigo-600/10 blur-3xl pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 -mb-8 h-48 w-48 rounded-full bg-violet-600/10 blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <LiveBadge status={streamState?.status} size="lg" />
              {isLive && (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-950/40 px-3 py-1 rounded-full border border-emerald-500/30">
                  <Zap className="h-3 w-3" />
                  Continuous 24×7 Background Mode
                </span>
              )}
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
              {isLive
                ? 'Broadcasting Live to YouTube'
                : '24×7 Video Loop Livestreaming'}
            </h1>
            <p className="max-w-2xl text-xs sm:text-sm text-slate-300">
              {isLive
                ? streamState?.playlist && streamState.playlist.length > 1
                  ? `Currently streaming playlist (${streamState.playlist.length} videos) continuously on YouTube. Video [${(streamState.currentIndex ?? 0) + 1}/${streamState.playlist.length}] "${streamState.currentVideo?.originalName || 'Video'}" is live.`
                  : `Currently looping "${streamState?.video?.originalName || 'video'}" indefinitely on the server via background FFmpeg.`
                : 'Select multiple videos for an endless sequential playlist, configure your YouTube RTMP stream key, and broadcast 24×7.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {isLive ? (
              <>
                <button
                  onClick={() => restartStream()}
                  disabled={isActionLoading}
                  className="flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-200 border border-slate-700 hover:bg-slate-700 hover:text-white transition-all disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 ${isActionLoading ? 'animate-spin' : ''}`} />
                  <span>Restart Stream</span>
                </button>
                <button
                  onClick={() => stopStream()}
                  disabled={isActionLoading}
                  className="flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-rose-600/30 hover:bg-rose-500 transition-all active:scale-95 disabled:opacity-50"
                >
                  <Square className="h-4 w-4 fill-current" />
                  <span>STOP STREAM</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => onNavigate('playlist')}
                  className="flex items-center gap-2 rounded-xl bg-slate-800/80 px-4 py-2.5 text-xs font-semibold text-slate-300 border border-slate-700 hover:bg-slate-700 hover:text-white transition-all"
                >
                  <span>Video Playlist</span>
                </button>
                <button
                  onClick={onOpenUpload}
                  className="flex items-center gap-2 rounded-xl bg-slate-800/80 px-4 py-2.5 text-xs font-semibold text-slate-300 border border-slate-700 hover:bg-slate-700 hover:text-white transition-all"
                >
                  <UploadCloud className="h-4 w-4" />
                  <span>Upload Video</span>
                </button>
                <button
                  onClick={() => onNavigate('start-stream')}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-xl shadow-indigo-600/30 hover:from-indigo-500 hover:to-violet-500 transition-all active:scale-95"
                >
                  <Play className="h-4 w-4 fill-current" />
                  <span>Configure & Start Stream</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* The 6 Core Dashboard Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {/* Card 1: Streaming Status */}
        <div className="rounded-2xl border border-slate-800 bg-[#0d121f] p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-3">
              <span className="uppercase tracking-wider">Stream Status</span>
              <Radio className={`h-4 w-4 ${isLive ? 'text-emerald-400' : 'text-slate-400'}`} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-white tracking-tight">
                {streamState?.status || 'STOPPED'}
              </span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>Mode</span>
            <span className="font-semibold text-slate-300">Server FFmpeg</span>
          </div>
        </div>

        {/* Card 2: Current Video */}
        <div className="rounded-2xl border border-slate-800 bg-[#0d121f] p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-3">
              <span className="uppercase tracking-wider">Current Video</span>
              <Film className="h-4 w-4 text-indigo-400" />
            </div>
            <p className="truncate text-base font-bold text-white" title={streamState?.video?.originalName || 'None'}>
              {streamState?.video?.originalName || 'No Video Selected'}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>Duration / Size</span>
            <span className="font-semibold text-slate-300 font-mono">
              {formatDuration(streamState?.video?.duration)} ({formatFileSize(streamState?.video?.size)})
            </span>
          </div>
        </div>

        {/* Card 3: Stream Uptime */}
        <div className="rounded-2xl border border-slate-800 bg-[#0d121f] p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-3">
              <span className="uppercase tracking-wider">Stream Uptime</span>
              <Clock className="h-4 w-4 text-amber-400" />
            </div>
            <p className="font-mono text-xl font-bold text-white tracking-wider">
              {streamState?.status === 'LIVE' ? streamState.uptimeFormatted : '00:00:00'}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>Reconnects</span>
            <span className="font-semibold text-slate-300 font-mono">
              {streamState?.reconnectCount || 0}
            </span>
          </div>
        </div>

        {/* Card 4: Stream Destination */}
        <div className="rounded-2xl border border-slate-800 bg-[#0d121f] p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-3">
              <span className="uppercase tracking-wider">Destination</span>
              <Youtube className="h-4 w-4 text-rose-500" />
            </div>
            <p className="text-sm font-bold text-white truncate">YouTube RTMP</p>
            <p className="text-xs text-slate-400 truncate mt-0.5">
              Key: {streamState?.config?.streamKeyMasked || '••••••••'}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>Ingest</span>
            <span className="font-semibold text-emerald-400">FLV RTMP</span>
          </div>
        </div>

        {/* Card 5: FFmpeg Process */}
        <div className="rounded-2xl border border-slate-800 bg-[#0d121f] p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-3">
              <span className="uppercase tracking-wider">FFmpeg Engine</span>
              <Cpu className="h-4 w-4 text-violet-400" />
            </div>
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${isLive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
              <span className="text-base font-bold text-white">
                {isLive ? `PID ${streamState?.pid}` : 'Standby'}
              </span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>Speed</span>
            <span className="font-semibold text-slate-300 font-mono">
              {streamState?.realtimeStats?.speed || '1.0x'}
            </span>
          </div>
        </div>

        {/* Card 6: Current Loop */}
        <div className="rounded-2xl border border-slate-800 bg-[#0d121f] p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-2">
              <span className="uppercase tracking-wider">Loop Counter</span>
              <Repeat className="h-4 w-4 text-indigo-400" />
            </div>
            <p className="text-xl font-bold text-white">
              {isLive ? `Loop #${streamState?.currentLoop || 1}` : 'Ready'}
            </p>
          </div>
          <div className="mt-3">
            <div className="flex justify-between text-[10px] text-slate-400 mb-1">
              <span>Loop Progress</span>
              <span>{isLive ? `${streamState?.loopProgressPercent}%` : '0%'}</span>
            </div>
            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-500"
                style={{ width: `${isLive ? streamState?.loopProgressPercent : 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Encoder Metrics Bar (When Live) */}
      {isLive && (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/10 p-5 backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Real-Time Broadcast Stream Health</h2>
                <p className="text-xs text-slate-400">Live encoder telemetry directly parsed from FFmpeg process</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6">
              <div className="text-center">
                <p className="text-[11px] uppercase text-slate-400">Live FPS</p>
                <p className="text-base font-mono font-bold text-emerald-400">
                  {streamState?.realtimeStats?.fps ?? 30.0}
                </p>
              </div>
              <div className="text-center">
                <p className="text-[11px] uppercase text-slate-400">Bitrate</p>
                <p className="text-base font-mono font-bold text-indigo-300">
                  {streamState?.realtimeStats?.bitrate || '4000kbits/s'}
                </p>
              </div>
              <div className="text-center">
                <p className="text-[11px] uppercase text-slate-400">Frames</p>
                <p className="text-base font-mono font-bold text-white">
                  {streamState?.realtimeStats?.frame != null
                    ? streamState.realtimeStats.frame.toLocaleString()
                    : '0'}
                </p>
              </div>
              <div className="text-center">
                <p className="text-[11px] uppercase text-slate-400">Stream Size</p>
                <p className="text-base font-mono font-bold text-violet-300">
                  {streamState?.realtimeStats?.size || '0kB'}
                </p>
              </div>
              <div className="text-center">
                <p className="text-[11px] uppercase text-slate-400">Speed</p>
                <p className="text-base font-mono font-bold text-amber-300">
                  {streamState?.realtimeStats?.speed || '1.00x'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: Live Terminal Logs & Quick Action Guide */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Terminal Logs Preview (2 columns) */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white">Server FFmpeg Live Console</h2>
              <span className="flex h-2 w-2 rounded-full bg-emerald-400" />
            </div>
            <button
              onClick={() => onNavigate('active-stream')}
              className="flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              <span>Detailed Monitor</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <TerminalLogs logs={logs} onClearLogs={clearLogs} maxHeight="max-h-80" />
        </div>

        {/* Side Guide / Broadcast Checklist (1 column) */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-[#0d121f] p-5 shadow-lg space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              24×7 Streaming Checklist
            </h2>

            <ul className="space-y-3 text-xs text-slate-300">
              <li className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600/20 text-indigo-400 font-bold text-[10px]">1</span>
                <div>
                  <strong className="text-white">Independent Server Execution:</strong> The stream runs on the host via FFmpeg. You can safely close this browser window at any time.
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600/20 text-indigo-400 font-bold text-[10px]">2</span>
                <div>
                  <strong className="text-white">Seamless Endless Looping:</strong> The selected video continuously restarts without dropped frames or manual intervention.
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600/20 text-indigo-400 font-bold text-[10px]">3</span>
                <div>
                  <strong className="text-white">Auto-Reconnect:</strong> If connection with YouTube is briefly interrupted, the backend automatically attempts to re-establish the stream.
                </div>
              </li>
            </ul>

            <div className="pt-2 border-t border-slate-800/80">
              <button
                onClick={() => onNavigate('library')}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-800/80 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700 transition-all"
              >
                <Film className="h-4 w-4 text-indigo-400" />
                <span>Manage Video Library</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
