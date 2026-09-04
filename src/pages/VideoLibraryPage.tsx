import React, { useState, useEffect } from 'react';
import {
  Film,
  UploadCloud,
  Play,
  Trash2,
  Edit2,
  Clock,
  Monitor,
  HardDrive,
  Check,
  X,
  Search,
  LayoutGrid,
  List,
  AlertCircle,
  Volume2,
  VolumeX,
  Loader2,
  ListOrdered,
  CheckSquare,
  Square,
  Sparkles,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Radio,
  ExternalLink
} from 'lucide-react';
import { VideoMetadata } from '../types/index.ts';
import { apiFetch } from '../lib/api.ts';
import { VideoPreviewModal } from '../components/VideoPreviewModal.tsx';
import { useStream } from '../context/StreamContext.tsx';
import { NavTab } from '../components/Sidebar.tsx';

interface VideoLibraryPageProps {
  onOpenUpload: () => void;
  onSelectForStream: (video: VideoMetadata) => void;
  onSelectPlaylistForStream?: (playlist: VideoMetadata[]) => void;
  onNavigate: (tab: NavTab) => void;
}

export const VideoLibraryPage: React.FC<VideoLibraryPageProps> = ({
  onOpenUpload,
  onSelectForStream,
  onSelectPlaylistForStream,
  onNavigate,
}) => {
  const { streamState } = useStream();
  const [videos, setVideos] = useState<VideoMetadata[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Multi-Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Preview, Rename & Delete States
  const [previewVideo, setPreviewVideo] = useState<VideoMetadata | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  
  // Custom Delete Modal State
  const [deleteTargetVideo, setDeleteTargetVideo] = useState<VideoMetadata | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchVideos = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await apiFetch<{ videos: VideoMetadata[] }>('/api/videos');
      setVideos(data.videos || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load video library');
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

  const showToast = (message: string) => {
    setSuccessToast(message);
    setTimeout(() => {
      setSuccessToast(null);
    }, 4000);
  };

  const handleToggleSelect = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredVideos.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredVideos.map((v) => v.id)));
    }
  };

  const handleStreamSelectedAsPlaylist = () => {
    const selectedVideos = videos.filter((v) => selectedIds.has(v.id));
    if (selectedVideos.length === 0) return;
    if (onSelectPlaylistForStream) {
      onSelectPlaylistForStream(selectedVideos);
    }
    onNavigate('start-stream');
  };

  const handleRename = async (id: string) => {
    if (!editingName.trim()) return;
    try {
      const res = await apiFetch<{ video: VideoMetadata }>(`/api/videos/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: editingName.trim() }),
      });
      setVideos((prev) => prev.map((v) => (v.id === id ? res.video : v)));
      setEditingId(null);
      showToast('Video renamed successfully');
    } catch (err: any) {
      alert(err.message || 'Failed to rename video');
    }
  };

  const handleOpenDeleteModal = (video: VideoMetadata, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDeleteTargetVideo(video);
    setDeleteError(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetVideo) return;
    setIsDeleting(true);
    setDeleteError(null);

    const targetId = deleteTargetVideo.id;
    const targetName = deleteTargetVideo.originalName;

    try {
      await apiFetch(`/api/videos/${targetId}`, { method: 'DELETE' });

      // On successful deletion:
      setVideos((prev) => prev.filter((v) => v.id !== targetId));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(targetId);
        return next;
      });
      setDeleteTargetVideo(null);
      showToast(`"${targetName}" was permanently deleted from server storage.`);
    } catch (err: any) {
      console.error('[Video Delete Failed]', err);
      setDeleteError(err.message || 'Failed to delete video from storage.');
    } finally {
      setIsDeleting(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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

  const isVideoStreaming = (video: VideoMetadata) => {
    if (
      streamState?.status === 'LIVE' ||
      streamState?.status === 'STARTING' ||
      streamState?.status === 'RECONNECTING' ||
      streamState?.status === 'PLAYING_VIDEO'
    ) {
      return (
        streamState?.video?.id === video.id ||
        streamState?.playlist?.some((p) => p.id === video.id) ||
        streamState?.activeConfig?.videoIds?.includes(video.id) ||
        streamState?.activeConfig?.videoId === video.id
      );
    }
    return false;
  };

  const filteredVideos = videos.filter((v) =>
    v.originalName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl bg-emerald-500/95 border border-emerald-400 px-5 py-3.5 text-sm font-semibold text-white shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-5">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight sm:text-2xl">
            Video Library & Storage
          </h1>
          <p className="text-xs text-slate-400">
            Upload, organize, and select videos for 24×7 multi-video YouTube playlists or single-video looping
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => onNavigate('playlist')}
            className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition-all"
          >
            <ListOrdered className="h-4 w-4 text-indigo-400" />
            <span>Playlist Manager</span>
          </button>

          <button
            onClick={onOpenUpload}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition-all active:scale-95"
          >
            <UploadCloud className="h-4 w-4" />
            <span>Upload New Video</span>
          </button>
        </div>
      </div>

      {/* Multi-Selection Bulk Action Toolbar */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-500/40 bg-indigo-950/40 p-4 shadow-xl backdrop-blur-sm animate-in fade-in">
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-xs font-bold text-white shadow-sm">
              {selectedIds.size}
            </span>
            <span className="text-xs font-bold text-white">
              {selectedIds.size} video{selectedIds.size > 1 ? 's' : ''} selected
            </span>
            <span className="text-xs text-indigo-300 hidden sm:inline">
              (Total duration:{' '}
              {formatDuration(
                videos
                  .filter((v) => selectedIds.has(v.id))
                  .reduce((acc, v) => acc + (v.duration || 0), 0)
              )}
              )
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedIds(new Set())}
              className="rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white"
            >
              Deselect All
            </button>
            <button
              onClick={handleStreamSelectedAsPlaylist}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 transition-all active:scale-95"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>Stream as 24×7 Playlist ({selectedIds.size} Videos)</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-slate-800 bg-[#0c111d] p-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search videos by name..."
            className="w-full rounded-xl border border-slate-800 bg-slate-900/80 py-2 pl-9 pr-4 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          {filteredVideos.length > 0 && (
            <button
              onClick={handleSelectAll}
              className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
            >
              {selectedIds.size === filteredVideos.length ? (
                <>
                  <CheckSquare className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Deselect All</span>
                </>
              ) : (
                <>
                  <Square className="h-3.5 w-3.5 text-slate-400" />
                  <span>Select All ({filteredVideos.length})</span>
                </>
              )}
            </button>
          )}

          <div className="flex items-center rounded-xl bg-slate-900 p-1 border border-slate-800">
            <button
              onClick={() => setViewMode('grid')}
              className={`rounded-lg p-1.5 transition-colors ${
                viewMode === 'grid'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`rounded-lg p-1.5 transition-colors ${
                viewMode === 'list'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Error View */}
      {error && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-5 text-xs text-rose-300 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-16 space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          <p className="text-xs text-slate-400">Loading video library from server...</p>
        </div>
      ) : filteredVideos.length === 0 ? (
        /* Empty State */
        <div className="rounded-3xl border border-dashed border-slate-800 bg-[#0c111d] p-12 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600/10 text-indigo-400 border border-indigo-500/20">
            <Film className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">No videos found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
              Upload your video assets (MP4, MKV, MOV, TS) to start streaming.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={onOpenUpload}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition-all"
            >
              <UploadCloud className="h-4 w-4" />
              <span>Upload Video</span>
            </button>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid View */
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredVideos.map((video) => {
            const isEditing = editingId === video.id;
            const isCurrentlyStreamed = isVideoStreaming(video);
            const isSelected = selectedIds.has(video.id);
            const isYouTube = video.sourceType === 'YOUTUBE' || video.sourceType === 'YOUTUBE_LIVE' || Boolean(video.youtubeVideoId);
            const isYouTubeLive = video.sourceType === 'YOUTUBE_LIVE' || video.liveStatus === 'LIVE';

            return (
              <div
                key={video.id}
                className={`group relative flex flex-col overflow-hidden rounded-2xl border bg-[#0d121f] transition-all duration-300 hover:shadow-xl ${
                  isSelected
                    ? 'border-indigo-500 ring-2 ring-indigo-500/50 bg-[#101628]'
                    : isCurrentlyStreamed
                    ? 'border-emerald-500/50 shadow-lg shadow-emerald-950/20'
                    : isYouTubeLive
                    ? 'border-rose-900/50 hover:border-rose-700/80'
                    : 'border-slate-800/80 hover:border-slate-700'
                }`}
              >
                {/* Thumbnail Header with Checkbox */}
                <div className="relative aspect-video w-full bg-slate-950 overflow-hidden">
                  {video.thumbnailUrl ? (
                    <img
                      src={video.thumbnailUrl}
                      alt={video.originalName}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950 text-slate-600">
                      {isYouTubeLive ? (
                        <Radio className="h-10 w-10 text-rose-500/60" />
                      ) : (
                        <Film className="h-10 w-10 stroke-1" />
                      )}
                    </div>
                  )}

                  {/* Multi-Select Checkbox overlay */}
                  <button
                    onClick={(e) => handleToggleSelect(video.id, e)}
                    className={`absolute top-2 left-2 z-20 flex h-7 w-7 items-center justify-center rounded-lg backdrop-blur-md transition-all ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'bg-black/60 text-slate-300 hover:bg-black/80 hover:text-white border border-white/20'
                    }`}
                  >
                    {isSelected ? (
                      <Check className="h-4 w-4 stroke-[3]" />
                    ) : (
                      <div className="h-3 w-3 rounded-sm border border-slate-300" />
                    )}
                  </button>

                  {/* Hover Quick Preview Button */}
                  <button
                    onClick={() => setPreviewVideo(video)}
                    className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100 backdrop-blur-[2px]"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600/90 text-white shadow-lg shadow-indigo-600/50">
                      <Play className="h-4 w-4 fill-current ml-0.5" />
                    </span>
                  </button>

                  {/* Duration or Live Status Badge */}
                  <span className="absolute bottom-2 right-2 rounded-md bg-black/75 px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-200 backdrop-blur-sm border border-white/10">
                    {isYouTubeLive ? (
                      <span className="flex items-center gap-1 text-rose-400 font-bold">
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-ping" />
                        LIVE
                      </span>
                    ) : (
                      formatDuration(video.duration)
                    )}
                  </span>

                  {/* Storage Provider & Source Badge */}
                  <div className="absolute bottom-2 left-2 flex items-center gap-1">
                    {isYouTubeLive ? (
                      <span className="flex items-center gap-1 rounded-md bg-rose-600/90 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-sm backdrop-blur-sm">
                        <Radio className="h-2.5 w-2.5" />
                        YT LIVE
                      </span>
                    ) : isYouTube ? (
                      <span className="flex items-center gap-1 rounded-md bg-rose-600/90 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-sm backdrop-blur-sm">
                        YOUTUBE
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 rounded-md bg-slate-900/85 px-1.5 py-0.5 text-[9px] font-medium text-slate-300 border border-slate-700 backdrop-blur-sm">
                        <HardDrive className="h-2.5 w-2.5 text-indigo-400" />
                        {video.sourceType === 'IMPORT' ? 'IMPORTED' : 'UPLOAD'}
                      </span>
                    )}
                    <span className="rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-400 border border-emerald-500/30 backdrop-blur-sm">
                      READY
                    </span>
                  </div>

                  {/* Live Stream Active Tag */}
                  {isCurrentlyStreamed && (
                    <span className="absolute top-2 right-2 rounded-md bg-emerald-600/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-sm animate-pulse">
                      STREAMING
                    </span>
                  )}
                </div>

                {/* Video Info Body */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    {isEditing ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="h-8 flex-1 rounded-lg bg-slate-950 px-2 text-xs text-white border border-indigo-500 focus:outline-none"
                          autoFocus
                        />
                        <button
                          onClick={() => handleRename(video.id)}
                          className="rounded-lg p-1.5 bg-emerald-600 text-white hover:bg-emerald-500"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="rounded-lg p-1.5 bg-slate-800 text-slate-400 hover:text-white"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div>
                        <h3
                          className="truncate text-sm font-bold text-white group-hover:text-indigo-300 transition-colors"
                          title={video.originalName}
                        >
                          {video.originalName}
                        </h3>
                        {video.channelTitle && (
                          <p className="text-[11px] text-slate-400 truncate mt-0.5">
                            {video.channelTitle}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <Monitor className="h-3 w-3 text-slate-400" />
                        {isYouTube ? '1080p HD' : `${video.width}×${video.height}`}
                      </span>
                      <span className="flex items-center gap-1 justify-end">
                        <HardDrive className="h-3 w-3 text-slate-400" />
                        {isYouTube ? (isYouTubeLive ? 'Live Stream' : 'YouTube') : formatFileSize(video.size)}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="font-mono text-slate-400">{isYouTube ? 'YouTube Source' : `${video.fps} FPS`}</span>
                      </span>
                      <span className="flex items-center gap-1 justify-end">
                        {isYouTube ? (
                          <span className="flex items-center gap-1 text-rose-400 font-medium">
                            <Radio className="h-3 w-3" /> Live Feed
                          </span>
                        ) : video.hasAudio ? (
                          <span className="flex items-center gap-1 text-emerald-400/80">
                            <Volume2 className="h-3 w-3" /> Audio
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-slate-400">
                            <VolumeX className="h-3 w-3" /> Muted
                          </span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 gap-2">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingId(video.id);
                          setEditingName(video.originalName);
                        }}
                        title="Rename"
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>

                      <button
                        onClick={(e) => handleOpenDeleteModal(video, e)}
                        title={
                          isCurrentlyStreamed
                            ? 'Cannot delete actively streaming video'
                            : 'Delete Video'
                        }
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-950/30 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <button
                      onClick={() => {
                        onSelectForStream(video);
                        onNavigate('start-stream');
                      }}
                      className="flex items-center gap-1.5 rounded-xl bg-red-600/20 px-3 py-1.5 text-xs font-bold text-red-300 border border-red-500/40 hover:bg-red-600 hover:text-white transition-all active:scale-95 shadow-sm"
                    >
                      <Play className="h-3 w-3 fill-current" />
                      <span>SELECT FOR LIVE</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0d121f] shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 bg-slate-900/60 uppercase text-slate-400 text-[10px] tracking-wider">
                <tr>
                  <th className="px-4 py-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={
                        selectedIds.size === filteredVideos.length && filteredVideos.length > 0
                      }
                      onChange={handleSelectAll}
                      className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                    />
                  </th>
                  <th className="px-4 py-3">Video / Stream</th>
                  <th className="px-4 py-3">Duration / Status</th>
                  <th className="px-4 py-3">Resolution</th>
                  <th className="px-4 py-3">FPS / Source</th>
                  <th className="px-4 py-3">File Size</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredVideos.map((video) => {
                  const isCurrentlyStreamed = isVideoStreaming(video);
                  const isSelected = selectedIds.has(video.id);
                  const isYouTube = video.sourceType === 'YOUTUBE' || video.sourceType === 'YOUTUBE_LIVE' || Boolean(video.youtubeVideoId);
                  const isYouTubeLive = video.sourceType === 'YOUTUBE_LIVE' || video.liveStatus === 'LIVE';

                  return (
                    <tr
                      key={video.id}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        isSelected
                          ? 'bg-indigo-950/20'
                          : isCurrentlyStreamed
                          ? 'bg-emerald-950/15'
                          : ''
                      }`}
                    >
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(video.id)}
                          className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            onClick={() => setPreviewVideo(video)}
                            className="relative h-10 w-16 shrink-0 rounded-lg bg-slate-950 overflow-hidden cursor-pointer border border-slate-800"
                          >
                            {video.thumbnailUrl ? (
                              <img
                                src={video.thumbnailUrl}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-slate-600">
                                {isYouTubeLive ? <Radio className="h-4 w-4 text-rose-500" /> : <Film className="h-4 w-4" />}
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-white max-w-xs truncate">
                                {video.originalName}
                              </p>
                              {isYouTubeLive && (
                                <span className="inline-flex items-center rounded px-1.5 py-0.2 text-[9px] font-bold bg-rose-600/30 text-rose-300 border border-rose-500/40">
                                  🔴 LIVE
                                </span>
                              )}
                              {isCurrentlyStreamed && (
                                <span className="inline-flex items-center rounded px-1.5 py-0.2 text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                  STREAMING
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400">
                              {video.channelTitle ? `${video.channelTitle} • ` : ''}
                              {new Date(video.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-300">
                        {isYouTubeLive ? (
                          <span className="text-rose-400 font-bold text-xs">24×7 Live</span>
                        ) : (
                          formatDuration(video.duration)
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-300">
                        {isYouTube ? '1080p HD' : `${video.width}×${video.height}`}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-300">
                        {isYouTube ? 'YouTube Stream' : `${video.fps} FPS`}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-300">
                        {isYouTube ? '—' : formatFileSize(video.size)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border ${
                          isYouTubeLive
                            ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                            : isYouTube
                            ? 'bg-red-500/10 text-red-300 border-red-500/30'
                            : 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}>
                          {isYouTubeLive ? <Radio className="h-3 w-3 text-rose-400" /> : <HardDrive className="h-3 w-3" />}
                          {isYouTubeLive ? 'YouTube Live' : isYouTube ? 'YouTube Video' : video.sourceType === 'IMPORT' ? 'Imported URL' : 'Uploaded File'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              onSelectForStream(video);
                              onNavigate('start-stream');
                            }}
                            className="rounded-lg bg-indigo-600 px-3 py-1.5 font-semibold text-white hover:bg-indigo-500 transition-colors"
                          >
                            Stream
                          </button>
                          <button
                            onClick={(e) => handleOpenDeleteModal(video, e)}
                            title="Delete Video"
                            className="rounded-lg p-1.5 text-slate-400 hover:text-rose-400 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTargetVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
          <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto custom-scrollbar rounded-2xl border border-slate-800 bg-[#0d121f] p-6 shadow-2xl space-y-5">
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-white">Delete Video</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Are you sure you want to permanently delete this video?
                </p>
              </div>
              <button
                onClick={() => setDeleteTargetVideo(null)}
                disabled={isDeleting}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Video Details Card */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white truncate max-w-[260px]" title={deleteTargetVideo.originalName}>
                  {deleteTargetVideo.originalName}
                </span>
                <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                  <HardDrive className="h-3 w-3" /> VPS Storage
                </span>
              </div>
              <div className="flex items-center gap-4 text-[11px] text-slate-400 font-mono">
                <span>Size: {formatFileSize(deleteTargetVideo.size)}</span>
                <span>•</span>
                <span>Duration: {formatDuration(deleteTargetVideo.duration)}</span>
              </div>
            </div>

            {/* Streaming Warning Check */}
            {isVideoStreaming(deleteTargetVideo) && (
              <div className="flex items-center gap-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-300">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
                <span>
                  <strong>Locked:</strong> This video is currently being streamed. You must stop the livestream before deleting it.
                </span>
              </div>
            )}

            {/* Error Message */}
            {deleteError && (
              <div className="flex items-start gap-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold">Deletion Failed</p>
                  <p className="mt-0.5 text-[11px]">{deleteError}</p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTargetVideo(null)}
                disabled={isDeleting}
                className="rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting || isVideoStreaming(deleteTargetVideo)}
                className="flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-rose-600/30 hover:bg-rose-500 transition-all disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Deleting from Server...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    <span>Delete Video</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video Preview Modal */}
      {previewVideo && (
        <VideoPreviewModal
          video={previewVideo}
          onClose={() => setPreviewVideo(null)}
          onSelectForStream={(video) => {
            onSelectForStream(video);
            onNavigate('start-stream');
          }}
        />
      )}
    </div>
  );
};

