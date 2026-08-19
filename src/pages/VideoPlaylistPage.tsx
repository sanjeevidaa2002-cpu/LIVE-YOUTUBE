import React, { useState, useEffect } from 'react';
import {
  ListOrdered,
  Plus,
  Play,
  ArrowUp,
  ArrowDown,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Radio,
  Film,
  UploadCloud,
  CheckSquare,
  Square,
  Sparkles,
  Volume2,
  VolumeX,
  Layers,
  ChevronRight,
  RefreshCw,
  Info
} from 'lucide-react';
import { VideoMetadata } from '../types/index.ts';
import { apiFetch } from '../lib/api.ts';
import { NavTab } from '../components/Sidebar.tsx';
import { VideoPreviewModal } from '../components/VideoPreviewModal.tsx';
import { useStream } from '../context/StreamContext.tsx';

interface VideoPlaylistPageProps {
  onNavigate: (tab: NavTab) => void;
  onOpenUpload: () => void;
  onSelectPlaylistForStream: (playlistVideos: VideoMetadata[]) => void;
}

export const VideoPlaylistPage: React.FC<VideoPlaylistPageProps> = ({
  onNavigate,
  onOpenUpload,
  onSelectPlaylistForStream,
}) => {
  const { streamState } = useStream();
  const [allVideos, setAllVideos] = useState<VideoMetadata[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // The ordered playlist items (array of VideoMetadata in exact play sequence)
  const [playlist, setPlaylist] = useState<VideoMetadata[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previewVideo, setPreviewVideo] = useState<VideoMetadata | null>(null);
  const [validationState, setValidationState] = useState<{
    isValidating: boolean;
    valid: boolean | null;
    message: string | null;
  }>({ isValidating: false, valid: null, message: null });

  const fetchVideos = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await apiFetch<{ videos: VideoMetadata[] }>('/api/videos');
      const loadedVideos = data.videos || [];
      setAllVideos(loadedVideos);

      // Default: If active stream has playlist, match it, otherwise select all or first 4
      if (streamState?.playlist && streamState.playlist.length > 0) {
        const activeIds = streamState.playlist.map((p) => p.id);
        const matched = activeIds
          .map((id) => loadedVideos.find((v) => v.id === id))
          .filter((v): v is VideoMetadata => !!v);
        if (matched.length > 0) {
          setPlaylist(matched);
          setSelectedIds(new Set(matched.map((v) => v.id)));
          return;
        }
      }

      // Default to selecting all or top videos
      if (loadedVideos.length > 0) {
        const initial = loadedVideos.slice(0, Math.min(4, loadedVideos.length));
        setPlaylist(initial);
        setSelectedIds(new Set(initial.map((v) => v.id)));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load videos for playlist');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  const handleToggleSelectVideo = (video: VideoMetadata) => {
    const nextSet = new Set(selectedIds);
    if (nextSet.has(video.id)) {
      nextSet.delete(video.id);
      setSelectedIds(nextSet);
      setPlaylist((prev) => prev.filter((v) => v.id !== video.id));
    } else {
      nextSet.add(video.id);
      setSelectedIds(nextSet);
      setPlaylist((prev) => [...prev, video]);
    }
  };

  const handleSelectAll = () => {
    const allSet = new Set(allVideos.map((v) => v.id));
    setSelectedIds(allSet);
    setPlaylist([...allVideos]);
  };

  const handleClearAll = () => {
    setSelectedIds(new Set());
    setPlaylist([]);
  };

  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    setPlaylist((prev) => {
      const copy = [...prev];
      const temp = copy[index - 1];
      copy[index - 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
  };

  const handleMoveDown = (index: number) => {
    if (index >= playlist.length - 1) return;
    setPlaylist((prev) => {
      const copy = [...prev];
      const temp = copy[index + 1];
      copy[index + 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
  };

  const handleRemoveFromPlaylist = (id: string) => {
    setPlaylist((prev) => prev.filter((v) => v.id !== id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleValidateWithFFprobe = async () => {
    if (playlist.length === 0) return;
    setValidationState({ isValidating: true, valid: null, message: 'Running FFprobe on each video in playlist...' });
    try {
      const res = await apiFetch<{ message: string; valid: boolean }>('/api/stream/validate-playlist', {
        method: 'POST',
        body: JSON.stringify({ videoIds: playlist.map((v) => v.id) }),
      });
      setValidationState({
        isValidating: false,
        valid: true,
        message: res.message || 'All videos verified and 100% compatible for 24×7 streaming!',
      });
    } catch (err: any) {
      setValidationState({
        isValidating: false,
        valid: false,
        message: err.message || 'Playlist validation failed.',
      });
    }
  };

  const handleLaunchStream = () => {
    if (playlist.length === 0) return;
    onSelectPlaylistForStream(playlist);
    onNavigate('start-stream');
  };

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

  const totalDurationSeconds = playlist.reduce((acc, v) => acc + (v.duration || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white tracking-tight sm:text-2xl">
              Multi-Video Playlist Manager
            </h1>
            <span className="rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-xs font-semibold text-indigo-400 border border-indigo-500/30">
              Sequential 24×7 Looper
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Combine multiple videos (e.g. 4 videos) into ONE continuous YouTube livestream. The sequence plays in order and loops forever.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onOpenUpload}
            className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700 hover:text-white transition-all"
          >
            <UploadCloud className="h-4 w-4 text-indigo-400" />
            <span>Upload Videos</span>
          </button>

          <button
            onClick={handleLaunchStream}
            disabled={playlist.length === 0}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
          >
            <Radio className="h-4 w-4 animate-pulse" />
            <span>Start Streaming Playlist ({playlist.length})</span>
          </button>
        </div>
      </div>

      {/* Info Notice about VPS Independence */}
      <div className="rounded-2xl border border-indigo-500/20 bg-indigo-950/20 p-4 backdrop-blur-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-indigo-500/20 p-2 text-indigo-400 border border-indigo-500/30">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-white">
              One Continuous Livestream • Zero Browser Dependency
            </h3>
            <p className="text-xs text-indigo-200/80 mt-0.5 leading-relaxed">
              When you start the stream, our server-side FFmpeg pipeline concatenates your selected videos in the exact sequence below and broadcasts to your YouTube RTMP key without stopping between videos. You can safely close your browser or turn off your computer — the VPS livestream continues 24×7!
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Layout: Active Queue vs Library Selector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Active Playlist Queue (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                <ListOrdered className="h-4 w-4" />
              </div>
              <h2 className="text-base font-bold text-white">Active Playlist Queue</h2>
              <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs font-semibold text-slate-300">
                {playlist.length} {playlist.length === 1 ? 'Video' : 'Videos'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleValidateWithFFprobe}
                disabled={playlist.length === 0 || validationState.isValidating}
                className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-all disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${validationState.isValidating ? 'animate-spin text-indigo-400' : ''}`} />
                <span>Validate with FFprobe</span>
              </button>
              <button
                onClick={handleClearAll}
                disabled={playlist.length === 0}
                className="rounded-lg px-2.5 py-1 text-[11px] font-medium text-rose-400 hover:bg-rose-500/10 transition-all disabled:opacity-40"
              >
                Clear Queue
              </button>
            </div>
          </div>

          {/* Validation Feedback Banner */}
          {validationState.message && (
            <div
              className={`rounded-xl border p-3 text-xs flex items-start gap-2.5 ${
                validationState.valid
                  ? 'border-emerald-500/30 bg-emerald-950/20 text-emerald-300'
                  : 'border-rose-500/30 bg-rose-950/20 text-rose-300'
              }`}
            >
              {validationState.valid ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
              )}
              <div className="flex-1 leading-relaxed">{validationState.message}</div>
            </div>
          )}

          {/* Playlist Summary Card */}
          <div className="grid grid-cols-3 gap-3 rounded-2xl border border-slate-800 bg-[#0c111d] p-4">
            <div>
              <p className="text-[11px] font-medium text-slate-400">Total Videos</p>
              <p className="text-lg font-bold text-white mt-0.5">{playlist.length}</p>
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-400">Full Loop Duration</p>
              <p className="text-lg font-bold text-indigo-400 mt-0.5">
                {formatDuration(totalDurationSeconds)}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-400">Stream Mode</p>
              <p className="text-lg font-bold text-emerald-400 mt-0.5">1 Stream (Loop 24×7)</p>
            </div>
          </div>

          {/* Queue List Items */}
          {playlist.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 p-10 text-center">
              <Film className="h-10 w-10 text-slate-600 mb-3" />
              <h3 className="text-sm font-semibold text-slate-300">Playlist is empty</h3>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                Select videos from the Library panel on the right or click "Select All" to build your sequential live stream queue.
              </p>
              <button
                onClick={handleSelectAll}
                className="mt-4 rounded-xl bg-indigo-600/20 px-3.5 py-1.5 text-xs font-semibold text-indigo-400 border border-indigo-500/30 hover:bg-indigo-600/30"
              >
                Add All Videos to Queue
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {playlist.map((video, index) => {
                const isCurrentlyLive =
                  streamState?.status === 'LIVE' &&
                  streamState?.currentVideo?.id === video.id;

                return (
                  <div
                    key={`${video.id}_${index}`}
                    className={`group relative flex items-center gap-3.5 rounded-2xl border p-3 transition-all ${
                      isCurrentlyLive
                        ? 'border-emerald-500/50 bg-emerald-950/20 ring-1 ring-emerald-500/40'
                        : 'border-slate-800/80 bg-[#0c111d] hover:border-slate-700'
                    }`}
                  >
                    {/* Index Sequence Number Badge */}
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-xs font-bold text-white border border-slate-700">
                      #{index + 1}
                    </div>

                    {/* Thumbnail */}
                    <div
                      onClick={() => setPreviewVideo(video)}
                      className="relative h-14 w-24 shrink-0 cursor-pointer overflow-hidden rounded-xl bg-slate-900 border border-slate-800 group-hover:border-slate-700"
                    >
                      {video.thumbnailUrl ? (
                        <img
                          src={video.thumbnailUrl}
                          alt={video.originalName}
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-slate-600">
                          <Film className="h-5 w-5" />
                        </div>
                      )}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                        <Play className="h-4 w-4 text-white" />
                      </div>
                    </div>

                    {/* Video Metadata Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-white">
                          {video.originalName}
                        </p>
                        {isCurrentlyLive && (
                          <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/40 animate-pulse">
                            NOW STREAMING
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-400">
                        <span className="flex items-center gap-1 font-mono text-slate-300">
                          <Clock className="h-3 w-3 text-indigo-400" />
                          {formatDuration(video.duration)}
                        </span>
                        <span>
                          {video.width}×{video.height} ({video.fps} FPS)
                        </span>
                        <span className="flex items-center gap-1">
                          {video.hasAudio ? (
                            <Volume2 className="h-3 w-3 text-emerald-400" />
                          ) : (
                            <span className="flex items-center gap-1 text-amber-400" title="Audio will be auto-generated for seamless stream">
                              <VolumeX className="h-3 w-3" /> Auto Silent Audio
                            </span>
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Reorder & Action Controls */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleMoveUp(index)}
                        disabled={index === 0}
                        title="Move Up in Playback Sequence"
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-20 transition-colors"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleMoveDown(index)}
                        disabled={index === playlist.length - 1}
                        title="Move Down in Playback Sequence"
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-20 transition-colors"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleRemoveFromPlaylist(video.id)}
                        title="Remove from playlist"
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-500/20 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Sequential Loop Flow Diagram */}
          {playlist.length > 1 && (
            <div className="rounded-2xl border border-slate-800 bg-[#0c111d] p-4">
              <div className="flex items-center gap-2 mb-2">
                <Layers className="h-4 w-4 text-indigo-400" />
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Continuous Playback Order
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {playlist.map((video, idx) => (
                  <React.Fragment key={`seq_${video.id}_${idx}`}>
                    <span className="rounded-lg bg-slate-800/80 px-2.5 py-1 font-medium text-slate-200 border border-slate-700">
                      <strong className="text-indigo-400">#{idx + 1}</strong> {video.originalName}
                    </span>
                    <ChevronRight className="h-3 w-3 text-slate-500" />
                  </React.Fragment>
                ))}
                <span className="rounded-lg bg-emerald-500/20 px-2.5 py-1 font-semibold text-emerald-400 border border-emerald-500/40">
                  ⟲ Auto-Loops Forever
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Video Library Selector (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-800 text-slate-300">
                <Film className="h-4 w-4" />
              </div>
              <h2 className="text-base font-bold text-white">Video Library</h2>
              <span className="text-xs text-slate-400">({allVideos.length} Available)</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleSelectAll}
                className="text-xs font-medium text-indigo-400 hover:text-indigo-300"
              >
                Select All
              </button>
            </div>
          </div>

          {/* Library Cards List */}
          {allVideos.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-[#0c111d] p-6 text-center">
              <Film className="h-8 w-8 text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-400">No videos in server storage yet.</p>
              <button
                onClick={onOpenUpload}
                className="mt-3 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
              >
                Upload Video Files
              </button>
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {allVideos.map((video) => {
                const isSelected = selectedIds.has(video.id);
                return (
                  <div
                    key={video.id}
                    onClick={() => handleToggleSelectVideo(video)}
                    className={`cursor-pointer flex items-center justify-between rounded-xl border p-3 transition-all ${
                      isSelected
                        ? 'border-indigo-500/40 bg-indigo-950/20'
                        : 'border-slate-800/80 bg-[#0c111d] hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="text-indigo-400">
                        {isSelected ? (
                          <CheckSquare className="h-5 w-5 text-indigo-400" />
                        ) : (
                          <Square className="h-5 w-5 text-slate-600" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-white">
                          {video.originalName}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {formatDuration(video.duration)} • {video.width}×{video.height}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewVideo(video);
                      }}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                    >
                      <Play className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Quick Action Footer */}
          <div className="rounded-2xl border border-slate-800 bg-[#0c111d] p-4">
            <h4 className="text-xs font-semibold text-slate-300">Ready to Broadcast?</h4>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
              Once you have arranged your desired video order, click the button below to proceed to stream configuration.
            </p>
            <button
              onClick={handleLaunchStream}
              disabled={playlist.length === 0}
              className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 disabled:opacity-40 transition-all"
            >
              <Radio className="h-4 w-4" />
              <span>Proceed to Start Stream with {playlist.length} Videos</span>
            </button>
          </div>
        </div>
      </div>

      {/* Video Preview Modal */}
      <VideoPreviewModal
        video={previewVideo}
        onClose={() => setPreviewVideo(null)}
      />
    </div>
  );
};
