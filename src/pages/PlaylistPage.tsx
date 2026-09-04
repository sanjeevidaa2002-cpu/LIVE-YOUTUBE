import React, { useState, useEffect } from 'react';
import {
  ListOrdered,
  Play,
  Film,
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  UploadCloud,
  ArrowRight,
  Info,
  Repeat,
  Sparkles,
  Check
} from 'lucide-react';
import { VideoMetadata } from '../types/index.ts';
import { apiFetch } from '../lib/api.ts';
import { NavTab } from '../components/Sidebar.tsx';
import { useStream } from '../context/StreamContext.tsx';

interface PlaylistPageProps {
  onNavigate: (tab: NavTab) => void;
  onOpenUpload: () => void;
  onStreamPlaylist: (playlist: VideoMetadata[]) => void;
}

export const PlaylistPage: React.FC<PlaylistPageProps> = ({
  onNavigate,
  onOpenUpload,
  onStreamPlaylist,
}) => {
  const { streamState } = useStream();
  const [allVideos, setAllVideos] = useState<VideoMetadata[]>([]);
  const [playlist, setPlaylist] = useState<VideoMetadata[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; message: string } | null>(null);

  const fetchVideos = async () => {
    try {
      setIsLoading(true);
      const res = await apiFetch<{ videos: VideoMetadata[] }>('/api/videos');
      const loaded = res.videos || [];
      setAllVideos(loaded);

      // Load saved playlist from localStorage if exists, or default to all videos (up to 4)
      const saved = localStorage.getItem('streamloop_playlist_ids');
      if (saved) {
        try {
          const ids: string[] = JSON.parse(saved);
          const mapped = ids
            .map((id) => loaded.find((v) => v.id === id))
            .filter((v): v is VideoMetadata => !!v);
          if (mapped.length > 0) {
            setPlaylist(mapped);
            return;
          }
        } catch {}
      }

      // Default to first 4 videos if available
      setPlaylist(loaded.slice(0, Math.min(4, loaded.length)));
    } catch (err) {
      console.error('Failed to load videos', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
    const handleVideosUpdated = () => {
      fetchVideos();
    };
    window.addEventListener('streamloop:videos-updated', handleVideosUpdated);
    return () => {
      window.removeEventListener('streamloop:videos-updated', handleVideosUpdated);
    };
  }, []);

  useEffect(() => {
    if (playlist.length > 0) {
      localStorage.setItem('streamloop_playlist_ids', JSON.stringify(playlist.map((v) => v.id)));
    }
  }, [playlist]);

  const handleAdd = (video: VideoMetadata) => {
    setPlaylist((prev) => [...prev, video]);
    setValidationResult(null);
  };

  const handleRemove = (index: number) => {
    setPlaylist((prev) => prev.filter((_, i) => i !== index));
    setValidationResult(null);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    setPlaylist((prev) => {
      const copy = [...prev];
      const temp = copy[index - 1];
      copy[index - 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
  };

  const handleMoveDown = (index: number) => {
    if (index === playlist.length - 1) return;
    setPlaylist((prev) => {
      const copy = [...prev];
      const temp = copy[index + 1];
      copy[index + 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
  };

  const handleValidate = async () => {
    if (playlist.length === 0) return;
    setIsValidating(true);
    try {
      const res = await apiFetch<{ valid: boolean; message: string }>('/api/stream/validate-playlist', {
        method: 'POST',
        body: JSON.stringify({ videoIds: playlist.map((v) => v.id) }),
      });
      setValidationResult({ valid: true, message: res.message });
    } catch (err: any) {
      setValidationResult({ valid: false, message: err.message || 'Validation failed' });
    } finally {
      setIsValidating(false);
    }
  };

  const handleLaunchStream = () => {
    if (playlist.length === 0) return;
    onStreamPlaylist(playlist);
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

  const totalDuration = playlist.reduce((acc, v) => acc + (v.duration || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <ListOrdered className="h-4 w-4" />
            </span>
            <h1 className="text-xl font-bold text-white tracking-tight sm:text-2xl">
              24×7 Multi-Video Playlist Sequence
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Combine multiple videos (e.g. 4 videos) into ONE uninterrupted, continuous YouTube livestream that loops forever.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onOpenUpload}
            className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition-all"
          >
            <UploadCloud className="h-4 w-4 text-indigo-400" />
            <span>Upload Videos</span>
          </button>

          <button
            onClick={handleLaunchStream}
            disabled={playlist.length === 0}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-indigo-600/30 hover:from-indigo-500 hover:to-violet-500 transition-all active:scale-95 disabled:opacity-50"
          >
            <Play className="h-4 w-4 fill-current" />
            <span>Stream This Playlist ({playlist.length})</span>
          </button>
        </div>
      </div>

      {/* VPS 24×7 Feature Explanation Card */}
      <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-r from-[#0e1428] via-[#0d1222] to-[#0c1624] p-5 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <span className="flex items-center gap-1.5 text-xs font-bold text-indigo-300">
              <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
              How the Multi-Video Loop Engine Works
            </span>
            <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
              Videos in the playlist queue are concatenated server-side using FFmpeg's continuous demuxer. When Video #1 finishes, Video #2 plays immediately, then #3, then #4. Once the final video ends, the stream seamlessly jumps back to Video #1 and loops indefinitely.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400">Total Loop Cycle</span>
              <p className="font-mono text-lg font-black text-white">{formatDuration(totalDuration)}</p>
            </div>
            <div className="h-10 w-px bg-slate-800" />
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400">Videos in Loop</span>
              <p className="font-mono text-lg font-black text-indigo-400">{playlist.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Playlist Sequence Builder & Available Videos */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Active Ordered Playlist Sequence (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-[#0c111d] p-5 space-y-4 shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-bold">
                  {playlist.length}
                </span>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  Sequential Playlist Queue
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleValidate}
                  disabled={playlist.length === 0 || isValidating}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-all disabled:opacity-50"
                >
                  <RefreshCw className={`h-3 w-3 ${isValidating ? 'animate-spin text-indigo-400' : ''}`} />
                  <span>Verify with FFprobe</span>
                </button>
                {playlist.length > 0 && (
                  <button
                    onClick={() => setPlaylist([])}
                    className="rounded-lg p-1 text-slate-500 hover:text-rose-400 text-xs"
                    title="Clear playlist"
                  >
                    Clear All
                  </button>
                )}
              </div>
            </div>

            {/* Validation Notice */}
            {validationResult && (
              <div
                className={`rounded-xl border p-3 text-xs flex items-center gap-2.5 ${
                  validationResult.valid
                    ? 'border-emerald-500/30 bg-emerald-950/20 text-emerald-300'
                    : 'border-rose-500/30 bg-rose-950/20 text-rose-300'
                }`}
              >
                {validationResult.valid ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
                )}
                <span>{validationResult.message}</span>
              </div>
            )}

            {/* Playlist Item Cards */}
            {playlist.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-800 p-10 text-center space-y-2 bg-slate-900/30">
                <ListOrdered className="h-8 w-8 text-slate-600 mx-auto" />
                <p className="text-xs font-semibold text-slate-300">Playlist is currently empty</p>
                <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                  Click the "+ Add" buttons on videos from the right panel to build your multi-video broadcast.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {playlist.map((video, idx) => (
                  <div
                    key={`pl_item_${video.id}_${idx}`}
                    className="group flex items-center justify-between rounded-xl border border-slate-800/90 bg-slate-900/60 p-3 hover:border-slate-700 transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-950 text-xs font-black text-indigo-400 border border-indigo-800/50">
                        #{idx + 1}
                      </span>

                      <div className="relative h-11 w-18 shrink-0 rounded-lg bg-slate-950 overflow-hidden border border-slate-800">
                        {video.thumbnailUrl ? (
                          <img src={video.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-slate-600">
                            <Film className="h-4 w-4" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-white" title={video.originalName}>
                          {video.originalName}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {formatDuration(video.duration)} • {video.width}×{video.height} • {video.fps} FPS
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleMoveUp(idx)}
                        disabled={idx === 0}
                        title="Move Up"
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-20 transition-colors"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleMoveDown(idx)}
                        disabled={idx === playlist.length - 1}
                        title="Move Down"
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-20 transition-colors"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleRemove(idx)}
                        title="Remove from playlist"
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-500/20 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Loop Summary Footer */}
            {playlist.length > 0 && (
              <div className="pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-slate-400">
                  <Repeat className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Playback will automatically repeat endlessly in this exact numerical sequence.</span>
                </div>

                <button
                  onClick={handleLaunchStream}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500 transition-all shrink-0"
                >
                  <span>Proceed to YouTube Stream</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Available Video Pool (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-[#0c111d] p-5 space-y-4 shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Available Video Library ({allVideos.length})
              </h2>

              <button
                onClick={onOpenUpload}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Upload More</span>
              </button>
            </div>

            {allVideos.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center bg-slate-900/30">
                <p className="text-xs text-slate-400">No uploaded videos on server.</p>
                <button
                  onClick={onOpenUpload}
                  className="mt-2 text-xs text-indigo-400 underline font-semibold"
                >
                  Upload your video files
                </button>
              </div>
            ) : (
              <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                {allVideos.map((video) => {
                  const countInPlaylist = playlist.filter((p) => p.id === video.id).length;

                  return (
                    <div
                      key={`avail_${video.id}`}
                      className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-900/40 p-2.5 hover:bg-slate-800/50 transition-all"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative h-10 w-14 shrink-0 rounded-lg bg-slate-950 overflow-hidden border border-slate-800">
                          {video.thumbnailUrl ? (
                            <img src={video.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-slate-600">
                              <Film className="h-3.5 w-3.5" />
                            </div>
                          )}
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-white" title={video.originalName}>
                            {video.originalName}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {formatDuration(video.duration)} • {video.width}×{video.height}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {countInPlaylist > 0 && (
                          <span className="rounded-md bg-indigo-950 px-1.5 py-0.5 text-[10px] font-bold text-indigo-400 border border-indigo-800/40">
                            {countInPlaylist}x in playlist
                          </span>
                        )}
                        <button
                          onClick={() => handleAdd(video)}
                          className="flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-semibold text-indigo-300 border border-slate-700 hover:bg-indigo-600 hover:text-white transition-all"
                        >
                          <Plus className="h-3 w-3" />
                          <span>Add</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
