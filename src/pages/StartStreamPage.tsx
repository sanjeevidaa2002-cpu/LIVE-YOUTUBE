import React, { useState, useEffect } from 'react';
import {
  Radio,
  Play,
  Film,
  ListOrdered,
  Key,
  Eye,
  EyeOff,
  Sliders,
  Repeat,
  Volume2,
  VolumeX,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Tv,
  ArrowRight,
  UploadCloud,
  HelpCircle,
  Lock,
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
  Layers,
  Sparkles,
  Copy,
  Check,
  Zap,
  CheckSquare
} from 'lucide-react';
import { VideoMetadata, StreamConfig } from '../types/index.ts';
import { apiFetch } from '../lib/api.ts';
import { useStream } from '../context/StreamContext.tsx';
import { NavTab } from '../components/Sidebar.tsx';

interface StartStreamPageProps {
  selectedVideo: VideoMetadata | null;
  selectedPlaylist?: VideoMetadata[] | null;
  onNavigate: (tab: NavTab) => void;
  onOpenUpload: () => void;
}

export const StartStreamPage: React.FC<StartStreamPageProps> = ({
  selectedVideo,
  selectedPlaylist,
  onNavigate,
  onOpenUpload,
}) => {
  const { streamState, startStream, isActionLoading, actionError } = useStream();

  const [videos, setVideos] = useState<VideoMetadata[]>([]);
  const [streamMode, setStreamMode] = useState<'single' | 'playlist'>('single');

  // Single video selection
  const [selectedVideoId, setSelectedVideoId] = useState<string>(selectedVideo?.id || '');

  // Playlist ordered items
  const [playlistItems, setPlaylistItems] = useState<VideoMetadata[]>([]);

  // YouTube RTMP Configuration
  const [rtmpUrl, setRtmpUrl] = useState<string>('rtmps://a.rtmp.youtube.com:443/live2');
  const [streamKey, setStreamKey] = useState<string>('');
  const [showStreamKey, setShowStreamKey] = useState<boolean>(false);
  const [hasCopiedKey, setHasCopiedKey] = useState<boolean>(false);
  const [loop, setLoop] = useState<boolean>(true);
  const [quality, setQuality] = useState<'source' | '720p' | '1080p'>('1080p');
  const [bitrate, setBitrate] = useState<string>('4500k');
  const [customBitrate, setCustomBitrate] = useState<string>('4500k');
  const [fps, setFps] = useState<'source' | '30' | '60'>('30');
  const [audio, setAudio] = useState<boolean>(true);
  const [autoReconnect, setAutoReconnect] = useState<boolean>(true);
  const [reconnectDelay, setReconnectDelay] = useState<number>(5);
  const [formError, setFormError] = useState<string | null>(null);

  // Validation state
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; message: string } | null>(null);

  // Test connection state
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Quick video picker modal state
  const [showVideoPicker, setShowVideoPicker] = useState<boolean>(false);

  useEffect(() => {
    // Load videos
    apiFetch<{ videos: VideoMetadata[] }>('/api/videos')
      .then((res) => {
        const loadedVideos = res.videos || [];
        setVideos(loadedVideos);

        if (selectedPlaylist && selectedPlaylist.length > 0) {
          setPlaylistItems(selectedPlaylist);
          setStreamMode('playlist');
        } else if (selectedVideo) {
          setSelectedVideoId(selectedVideo.id);
          setPlaylistItems([selectedVideo]);
          setStreamMode('single');
        } else if (loadedVideos.length > 0) {
          setSelectedVideoId(loadedVideos[0].id);
          setPlaylistItems([loadedVideos[0]]);
        }
      })
      .catch(console.error);

    // Load default settings
    apiFetch<{ settings: any }>('/api/settings')
      .then((res) => {
        if (res.settings) {
          if (res.settings.defaultRtmpUrl) setRtmpUrl(res.settings.defaultRtmpUrl);
          if (res.settings.defaultQuality) setQuality(res.settings.defaultQuality);
          if (res.settings.defaultBitrate) setBitrate(res.settings.defaultBitrate);
          if (res.settings.defaultFps) setFps(res.settings.defaultFps);
          if (res.settings.autoReconnect !== undefined) setAutoReconnect(res.settings.autoReconnect);
          if (res.settings.reconnectDelay) setReconnectDelay(res.settings.reconnectDelay);
        }
      })
      .catch(console.error);
  }, [selectedVideo, selectedPlaylist]);

  const currentSelectedVideo = videos.find((v) => v.id === selectedVideoId) || videos[0] || null;

  const handleAddVideoToPlaylist = (id: string) => {
    const video = videos.find((v) => v.id === id);
    if (video) {
      setPlaylistItems((prev) => [...prev, video]);
      setValidationResult(null);
    }
  };

  const handleRemoveFromPlaylist = (index: number) => {
    setPlaylistItems((prev) => prev.filter((_, i) => i !== index));
    setValidationResult(null);
  };

  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    setPlaylistItems((prev) => {
      const copy = [...prev];
      const temp = copy[index - 1];
      copy[index - 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
  };

  const handleMoveDown = (index: number) => {
    if (index >= playlistItems.length - 1) return;
    setPlaylistItems((prev) => {
      const copy = [...prev];
      const temp = copy[index + 1];
      copy[index + 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
  };

  const handleCopyStreamKey = () => {
    if (!streamKey) return;
    navigator.clipboard.writeText(streamKey);
    setHasCopiedKey(true);
    setTimeout(() => setHasCopiedKey(false), 2000);
  };

  const handleTestConnection = async () => {
    setFormError(null);
    setTestResult(null);

    if (!rtmpUrl.trim()) {
      setFormError('Please enter a YouTube RTMP Stream URL.');
      return;
    }

    if (!streamKey.trim()) {
      setFormError('Please enter your YouTube Stream Key.');
      return;
    }

    const videoIdsToStream = streamMode === 'playlist'
      ? playlistItems.map((v) => v.id)
      : (selectedVideoId ? [selectedVideoId] : []);

    if (videoIdsToStream.length === 0) {
      setFormError('Please select a video from your library.');
      return;
    }

    setIsTesting(true);
    try {
      const res = await apiFetch<{ success: boolean; message: string; error?: string }>('/api/stream/test', {
        method: 'POST',
        body: JSON.stringify({
          rtmpUrl: rtmpUrl.trim(),
          streamKey: streamKey.trim(),
          videoId: videoIdsToStream[0],
          videoIds: videoIdsToStream,
        }),
      });

      setTestResult({
        success: true,
        message: res.message || 'Stream URL, Stream Key, Video File, and FFmpeg server engine verified successfully!',
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Connection test failed. Please verify your RTMP settings.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const validatePlaylist = async () => {
    const ids = streamMode === 'playlist' ? playlistItems.map((v) => v.id) : (selectedVideoId ? [selectedVideoId] : []);
    if (ids.length === 0) return;

    setIsValidating(true);
    try {
      const res = await apiFetch<{ valid: boolean; message: string }>('/api/stream/validate-playlist', {
        method: 'POST',
        body: JSON.stringify({ videoIds: ids }),
      });
      setValidationResult({ valid: true, message: res.message });
    } catch (err: any) {
      setValidationResult({ valid: false, message: err.message || 'Validation failed' });
    } finally {
      setIsValidating(false);
    }
  };

  const isAlreadyLive = streamState?.status === 'LIVE' || streamState?.status === 'STARTING';

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

  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const totalPlaylistDuration = playlistItems.reduce((acc, v) => acc + (v.duration || 0), 0);

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const videoIdsToStream = streamMode === 'playlist'
      ? playlistItems.map((v) => v.id)
      : (selectedVideoId ? [selectedVideoId] : []);

    if (videoIdsToStream.length === 0) {
      setFormError('Please select at least one video for the stream.');
      return;
    }

    if (!rtmpUrl.trim()) {
      setFormError('Please enter a valid YouTube RTMP server URL.');
      return;
    }

    if (!streamKey.trim()) {
      setFormError('YouTube Stream Key is required.');
      return;
    }

    const config: StreamConfig = {
      videoId: videoIdsToStream[0],
      videoIds: videoIdsToStream,
      rtmpUrl: rtmpUrl.trim(),
      streamKey: streamKey.trim(),
      loop,
      quality,
      bitrate: bitrate === 'custom' ? customBitrate : bitrate,
      fps,
      audio,
      autoReconnect,
      reconnectDelay,
    };

    const success = await startStream(config);
    if (success) {
      onNavigate('active-stream');
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-red-600 text-white shadow-md shadow-red-600/30 font-black text-xs">
              ▶
            </span>
            <h1 className="text-xl font-bold text-white tracking-tight sm:text-2xl">
              YouTube Live Streaming Setup
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Broadcast a continuous 24×7 loop stream to YouTube Live via server-side FFmpeg.
          </p>
        </div>

        <button
          onClick={onOpenUpload}
          className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700 hover:text-white transition-all"
        >
          <UploadCloud className="h-4 w-4 text-indigo-400" />
          <span>Upload / Import Video</span>
        </button>
      </div>

      {/* Active Stream Alert */}
      {isAlreadyLive && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-5 backdrop-blur-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-amber-300">
                  A Live Broadcast is Currently Active!
                </h3>
                <p className="text-xs text-amber-200/80 mt-1">
                  FFmpeg is actively broadcasting on PID {streamState?.pid}. To start a new stream with different videos or settings, first stop the active stream.
                </p>
              </div>
            </div>
            <button
              onClick={() => onNavigate('active-stream')}
              className="flex items-center gap-1.5 rounded-xl bg-amber-500/20 px-3.5 py-1.5 text-xs font-semibold text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 shrink-0"
            >
              <span>View Active Stream</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Mode Switcher: Single Video vs Multi-Video Playlist */}
      <div className="rounded-2xl border border-slate-800 bg-[#0c111d] p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white">Playback Mode</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Choose single video loop or sequential multi-video playlist
            </p>
          </div>

          <div className="flex items-center rounded-xl bg-slate-900 p-1 border border-slate-800">
            <button
              type="button"
              onClick={() => setStreamMode('single')}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                streamMode === 'single'
                  ? 'bg-red-600 text-white shadow-sm shadow-red-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Film className="h-3.5 w-3.5" />
              <span>Single Video Loop</span>
            </button>

            <button
              type="button"
              onClick={() => setStreamMode('playlist')}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                streamMode === 'playlist'
                  ? 'bg-red-600 text-white shadow-sm shadow-red-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ListOrdered className="h-3.5 w-3.5" />
              <span>Multi-Video Playlist ({playlistItems.length})</span>
            </button>
          </div>
        </div>
      </div>

      <form onSubmit={handleStart} className="space-y-6">
        {/* SECTION 1: Selected Video / Playlist */}
        <div className="rounded-2xl border border-slate-800 bg-[#0c111d] p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-600/20 text-red-400 border border-red-500/30">
                {streamMode === 'playlist' ? <ListOrdered className="h-4 w-4" /> : <Film className="h-4 w-4" />}
              </div>
              <div>
                <h2 className="text-base font-bold text-white">
                  {streamMode === 'playlist' ? '1. Multi-Video Playlist Sequence' : '1. Selected Video for Live Stream'}
                </h2>
                <p className="text-xs text-slate-400">
                  {streamMode === 'playlist'
                    ? 'All videos below will play in order, looping continuously.'
                    : 'The video below will be streamed and looped infinitely to YouTube Live.'}
                </p>
              </div>
            </div>

            {streamMode === 'single' && videos.length > 0 && (
              <button
                type="button"
                onClick={() => setShowVideoPicker(!showVideoPicker)}
                className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition-all"
              >
                <Film className="h-3.5 w-3.5 text-indigo-400" />
                <span>Change Video</span>
              </button>
            )}

            {streamMode === 'playlist' && (
              <button
                type="button"
                onClick={validatePlaylist}
                disabled={playlistItems.length === 0 || isValidating}
                className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-all disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${isValidating ? 'animate-spin text-indigo-400' : ''}`} />
                <span>Validate with FFprobe</span>
              </button>
            )}
          </div>

          {/* Validation message if available */}
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

          {/* Single Video Card */}
          {streamMode === 'single' ? (
            currentSelectedVideo ? (
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-slate-800/90 bg-slate-900/60 p-4">
                  <div className="flex items-center gap-4">
                    <div className="relative h-16 w-24 shrink-0 rounded-xl bg-slate-950 overflow-hidden border border-slate-800">
                      {currentSelectedVideo.thumbnailUrl ? (
                        <img
                          src={currentSelectedVideo.thumbnailUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-slate-600">
                          <Film className="h-6 w-6" />
                        </div>
                      )}
                      <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 py-0.2 font-mono text-[9px] text-white">
                        {formatDuration(currentSelectedVideo.duration)}
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-white max-w-sm truncate">
                          {currentSelectedVideo.originalName}
                        </h4>
                        <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
                          READY
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2.5 mt-1 text-xs text-slate-400">
                        <span>{currentSelectedVideo.width}×{currentSelectedVideo.height}</span>
                        <span>•</span>
                        <span>{currentSelectedVideo.fps} FPS</span>
                        <span>•</span>
                        <span>{formatFileSize(currentSelectedVideo.size)}</span>
                        <span>•</span>
                        <span className="text-indigo-400 font-medium">
                          {currentSelectedVideo.sourceType === 'IMPORT' ? 'Imported' : 'Uploaded'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowVideoPicker(!showVideoPicker)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                  >
                    Select Another
                  </button>
                </div>

                {/* Quick Video Switcher Dropdown */}
                {showVideoPicker && (
                  <div className="rounded-2xl border border-indigo-500/30 bg-slate-900/90 p-4 space-y-3">
                    <p className="text-xs font-semibold text-slate-200">
                      Choose from Video Library:
                    </p>
                    <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-800">
                      {videos.map((v) => (
                        <div
                          key={v.id}
                          onClick={() => {
                            setSelectedVideoId(v.id);
                            setShowVideoPicker(false);
                            setTestResult(null);
                          }}
                          className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-colors ${
                            v.id === selectedVideoId
                              ? 'bg-indigo-600/30 border border-indigo-500/50'
                              : 'hover:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-3 truncate">
                            <Film className="h-4 w-4 text-slate-400 shrink-0" />
                            <span className="text-xs text-white truncate font-medium">{v.originalName}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-400 shrink-0">
                            <span className="font-mono">{formatDuration(v.duration)}</span>
                            {v.id === selectedVideoId && <Check className="h-4 w-4 text-emerald-400" />}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 text-center">
                <Film className="h-8 w-8 text-slate-500 mb-2" />
                <p className="text-sm font-semibold text-white">No videos in your library</p>
                <p className="text-xs text-slate-400 mt-1 mb-4">
                  Upload an MP4/MKV video to start streaming.
                </p>
                <button
                  type="button"
                  onClick={onOpenUpload}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-md hover:bg-indigo-500"
                >
                  Upload Video Now
                </button>
              </div>
            )
          ) : (
            /* Multi-Video Playlist Sequence */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-300">
                  {playlistItems.length} videos in playlist ({formatDuration(totalPlaylistDuration)} total loop duration)
                </span>
              </div>

              {playlistItems.length === 0 ? (
                <div className="p-6 text-center rounded-xl border border-dashed border-slate-800 text-xs text-slate-400">
                  Playlist is empty. Add videos from below.
                </div>
              ) : (
                <div className="space-y-2">
                  {playlistItems.map((item, idx) => (
                    <div
                      key={`${item.id}-${idx}`}
                      className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 p-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-800 text-xs font-bold text-slate-300 font-mono">
                          {idx + 1}
                        </span>
                        <div>
                          <p className="text-xs font-semibold text-white truncate max-w-sm">
                            {item.originalName}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            {formatDuration(item.duration)} • {item.width}×{item.height} • {item.fps}fps
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleMoveUp(idx)}
                          disabled={idx === 0}
                          className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveDown(idx)}
                          disabled={idx === playlistItems.length - 1}
                          className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveFromPlaylist(idx)}
                          className="p-1 text-slate-400 hover:text-rose-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add video to playlist dropdown */}
              {videos.length > 0 && (
                <div className="flex items-center gap-2 pt-2">
                  <select
                    id="add-playlist-select"
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) {
                        handleAddVideoToPlaylist(e.target.value);
                        e.target.value = '';
                      }
                    }}
                    className="flex-1 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="" disabled>
                      + Add another video from library to playlist sequence...
                    </option>
                    {videos.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.originalName} ({formatDuration(v.duration)})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
        </div>

        {/* SECTION 2: YouTube Live Settings (URL & Key) */}
        <div className="rounded-2xl border border-slate-800 bg-[#0c111d] p-6 space-y-5">
          <div className="flex items-center gap-2.5 border-b border-slate-800/80 pb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-600/20 text-red-400 border border-red-500/30">
              <Radio className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">2. YouTube Live Server & Key</h2>
              <p className="text-xs text-slate-400">
                Destination RTMP ingestion endpoint and protected stream key from YouTube Studio
              </p>
            </div>
          </div>

          {/* YouTube RTMP URL */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-200">
                YouTube Stream URL (RTMP / RTMPS)
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => { setRtmpUrl('rtmps://a.rtmp.youtube.com:443/live2'); setTestResult(null); }}
                  className={`rounded-lg px-2.5 py-1 text-[10px] font-semibold border transition-all ${
                    rtmpUrl.includes('a.rtmp.youtube.com')
                      ? 'bg-red-600/20 text-red-300 border-red-500/40'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                  }`}
                >
                  YouTube Primary (RTMPS :443)
                </button>
                <button
                  type="button"
                  onClick={() => { setRtmpUrl('rtmps://b.rtmp.youtube.com:443/live2'); setTestResult(null); }}
                  className={`rounded-lg px-2.5 py-1 text-[10px] font-semibold border transition-all ${
                    rtmpUrl.includes('b.rtmp.youtube.com')
                      ? 'bg-red-600/20 text-red-300 border-red-500/40'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                  }`}
                >
                  YouTube Backup
                </button>
              </div>
            </div>
            <input
              type="text"
              value={rtmpUrl}
              onChange={(e) => { setRtmpUrl(e.target.value); setTestResult(null); }}
              placeholder="rtmps://a.rtmp.youtube.com:443/live2"
              className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-xs font-mono text-white focus:border-red-500 focus:outline-none"
            />
            <p className="text-[11px] text-slate-500">
              Standard YouTube RTMP Server URL (`rtmps://a.rtmp.youtube.com:443/live2`). Secure TLS port 443 prevents cloud network blocks.
            </p>
          </div>

          {/* YouTube Stream Key */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-200">
                YouTube Stream Key
              </label>
              <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                <Lock className="h-3 w-3" /> Protected & Masked (Never logged or made public)
              </span>
            </div>
            <div className="relative flex items-center">
              <input
                type={showStreamKey ? 'text' : 'password'}
                value={streamKey}
                onChange={(e) => { setStreamKey(e.target.value); setTestResult(null); }}
                placeholder="Paste your stream key here (e.g. xxxx-xxxx-xxxx-xxxx-xxxx)"
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 pr-20 text-xs font-mono text-white focus:border-red-500 focus:outline-none"
              />
              <div className="absolute right-2 flex items-center gap-1">
                {streamKey && (
                  <button
                    type="button"
                    onClick={handleCopyStreamKey}
                    title="Copy Key"
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    {hasCopiedKey ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowStreamKey(!showStreamKey)}
                  title={showStreamKey ? 'Hide Key' : 'Show Key'}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                >
                  {showStreamKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <p className="text-[11px] text-slate-500">
              Found in YouTube Studio → Create → Go Live → Stream Settings.
            </p>
          </div>
        </div>

        {/* SECTION 3: Loop, Auto-Restart & Encoding Settings */}
        <div className="rounded-2xl border border-slate-800 bg-[#0c111d] p-6 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-800/80 pb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Sliders className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">3. Loop Control & Encoding Quality</h2>
              <p className="text-xs text-slate-400">
                Continuous loop playback, automatic reconnect retry, and H.264 video quality
              </p>
            </div>
          </div>

          {/* Looping & Auto Reconnect Toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className={`flex items-start gap-3 rounded-xl border p-3.5 cursor-pointer transition-all ${
              loop
                ? 'border-indigo-500/50 bg-indigo-950/20'
                : 'border-slate-800 bg-slate-900/60'
            }`}>
              <input
                type="checkbox"
                checked={loop}
                onChange={(e) => setLoop(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold text-white">Continuous 24×7 Loop</p>
                  <span className={`px-1.5 py-0.2 text-[9px] font-extrabold rounded ${loop ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                    {loop ? 'ENABLED' : 'DISABLED'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {loop ? 'Plays seamlessly without stopping forever.' : 'Plays once and terminates FFmpeg when finished.'}
                </p>
              </div>
            </label>

            <label className={`flex items-start gap-3 rounded-xl border p-3.5 cursor-pointer transition-all ${
              autoReconnect
                ? 'border-indigo-500/50 bg-indigo-950/20'
                : 'border-slate-800 bg-slate-900/60'
            }`}>
              <input
                type="checkbox"
                checked={autoReconnect}
                onChange={(e) => setAutoReconnect(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold text-white">Auto-Restart on Drops</p>
                  <span className={`px-1.5 py-0.2 text-[9px] font-extrabold rounded ${autoReconnect ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                    {autoReconnect ? 'ENABLED' : 'DISABLED'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Auto-retries with exponential backoff if YouTube RTMP network connection drops.
                </p>
              </div>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            {/* Output Quality */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Resolution</label>
              <select
                value={quality}
                onChange={(e: any) => setQuality(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="1080p">1080p Full HD (1920×1080)</option>
                <option value="720p">720p HD (1280×720)</option>
                <option value="source">Source Resolution</option>
              </select>
            </div>

            {/* Framerate */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Framerate</label>
              <select
                value={fps}
                onChange={(e: any) => setFps(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="30">30 FPS (Standard)</option>
                <option value="60">60 FPS (High Motion)</option>
                <option value="source">Source Framerate</option>
              </select>
            </div>

            {/* Video Bitrate */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Video Bitrate</label>
              <select
                value={bitrate}
                onChange={(e) => setBitrate(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="4500k">4500 kbps (1080p recommended)</option>
                <option value="3000k">3000 kbps (720p standard)</option>
                <option value="6000k">6000 kbps (1080p high bitrate)</option>
                <option value="auto">Auto (Balanced)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Test Connection Result Notice */}
        {testResult && (
          <div
            className={`rounded-2xl border p-4 text-xs flex items-start gap-3 backdrop-blur-sm animate-in fade-in ${
              testResult.success
                ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300'
                : 'border-rose-500/40 bg-rose-950/30 text-rose-300'
            }`}
          >
            {testResult.success ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400 mt-0.5" />
            ) : (
              <AlertCircle className="h-5 w-5 shrink-0 text-rose-400 mt-0.5" />
            )}
            <div>
              <p className="font-bold text-sm">
                {testResult.success ? 'Configuration Verified' : 'Configuration Error'}
              </p>
              <p className="mt-0.5">{testResult.message}</p>
            </div>
          </div>
        )}

        {/* Error Feedback */}
        {(formError || actionError) && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-4 text-xs text-rose-300 flex items-center gap-3">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{formError || actionError}</span>
          </div>
        )}

        {/* Action Controls: Test Connection & Start Live Stream */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting || isActionLoading}
            className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/90 px-5 py-3 text-xs font-bold text-slate-200 hover:bg-slate-700 hover:text-white transition-all disabled:opacity-50"
          >
            <Zap className={`h-4 w-4 ${isTesting ? 'animate-spin text-amber-400' : 'text-amber-400'}`} />
            <span>{isTesting ? 'Testing Connection...' : 'TEST CONNECTION'}</span>
          </button>

          <button
            type="submit"
            disabled={isActionLoading || isAlreadyLive}
            className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 px-7 py-3 text-sm font-bold text-white shadow-xl shadow-red-600/30 hover:from-red-500 hover:to-rose-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
          >
            {isActionLoading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Initializing Server FFmpeg Process...</span>
              </>
            ) : (
              <>
                <Radio className="h-4 w-4 animate-pulse" />
                <span>
                  {streamMode === 'playlist'
                    ? `START YOUTUBE LIVE PLAYLIST (${playlistItems.length} Videos)`
                    : 'START YOUTUBE LIVE STREAM'}
                </span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
