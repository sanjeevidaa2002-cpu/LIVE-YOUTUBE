import React, { useState, useRef, useEffect } from 'react';
import { X, Film, Clock, Monitor, HardDrive, AlertCircle, RefreshCw, Terminal, CheckCircle2, Radio, ExternalLink } from 'lucide-react';
import { VideoMetadata } from '../types/index.ts';

interface VideoPreviewModalProps {
  video: VideoMetadata | null;
  onClose: () => void;
  onSelectForStream?: (video: VideoMetadata) => void;
}

export const VideoPreviewModal: React.FC<VideoPreviewModalProps> = ({
  video,
  onClose,
  onSelectForStream,
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isLoadingMetadata, setIsLoadingMetadata] = useState<boolean>(true);
  const [showDebug, setShowDebug] = useState<boolean>(false);
  const [networkStatus, setNetworkStatus] = useState<string>('Connecting...');
  const [videoEventLog, setVideoEventLog] = useState<string[]>([]);
  const [retryCount, setRetryCount] = useState<number>(0);

  const videoRef = useRef<HTMLVideoElement>(null);

  const isYouTube = video?.sourceType === 'YOUTUBE' || video?.sourceType === 'YOUTUBE_LIVE' || Boolean(video?.youtubeVideoId);
  const isYouTubeLive = video?.sourceType === 'YOUTUBE_LIVE' || video?.liveStatus === 'LIVE';

  useEffect(() => {
    setHasError(false);
    setErrorMessage('');
    setIsLoadingMetadata(!isYouTube);
    setVideoEventLog([]);
    setNetworkStatus('Loading source...');

    if (!isYouTube && videoRef.current) {
      videoRef.current.load();
    }
  }, [video, retryCount, isYouTube]);

  if (!video) return null;

  const token = localStorage.getItem('streamloop_token') || '';
  const queryParams = new URLSearchParams();
  if (token) queryParams.append('token', token);
  if (retryCount > 0) queryParams.append('retry', String(retryCount));
  const queryString = queryParams.toString();
  const videoSrc = `/api/videos/${video.id}/preview${queryString ? `?${queryString}` : ''}`;

  const logEvent = (evtName: string) => {
    setVideoEventLog((prev) => [...prev.slice(-8), `${new Date().toLocaleTimeString()} - ${evtName}`]);
  };

  const formatDuration = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0s';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs}h ${mins}m ${secs}s`;
    }
    return `${mins}m ${secs}s`;
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleRetry = () => {
    setHasError(false);
    setErrorMessage('');
    setIsLoadingMetadata(true);
    setRetryCount((prev) => prev + 1);
    if (videoRef.current) {
      videoRef.current.load();
      videoRef.current.play().catch(() => {});
    }
  };

  const youtubeVideoId = video.youtubeVideoId || (video.path ? '' : video.storedName);
  const youtubeWatchUrl = video.sourceUrl || (youtubeVideoId ? `https://www.youtube.com/watch?v=${youtubeVideoId}` : '');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-4xl rounded-2xl border border-slate-800 bg-[#0e1320] shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-3 overflow-hidden">
            {isYouTubeLive ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-600/20 text-rose-300 border border-rose-500/40 text-xs font-bold shrink-0">
                <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
                <span>YOUTUBE LIVE</span>
              </div>
            ) : isYouTube ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-600/20 text-rose-300 border border-rose-500/30 text-xs font-bold shrink-0">
                <Film className="h-3.5 w-3.5 text-rose-400" />
                <span>YOUTUBE</span>
              </div>
            ) : (
              <Film className="h-5 w-5 text-indigo-400 shrink-0" />
            )}
            <div className="overflow-hidden">
              <h2 className="truncate text-base font-bold text-white">{video.originalName}</h2>
              {video.channelTitle && (
                <p className="text-xs text-slate-400 truncate">{video.channelTitle}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {youtubeWatchUrl && (
              <a
                href={youtubeWatchUrl}
                target="_blank"
                rel="noreferrer"
                className="hidden sm:flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white bg-slate-900 border border-slate-800 hover:bg-slate-800 transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>YouTube</span>
              </a>
            )}
            {!isYouTube && (
              <button
                onClick={() => setShowDebug(!showDebug)}
                className={`rounded-lg px-2.5 py-1 text-xs font-mono transition-colors border ${
                  showDebug ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Terminal className="h-3.5 w-3.5 inline mr-1" />
                Debug
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Video Player & Error Screen */}
        <div className="relative bg-black flex items-center justify-center aspect-video w-full max-h-[52vh]">
          {isYouTube ? (
            <iframe
              title={video.originalName}
              src={`https://www.youtube-nocookie.com/embed/${youtubeVideoId}?autoplay=1&enablejsapi=1&rel=0`}
              className="h-full w-full object-contain border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          ) : hasError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 p-6 text-center">
              <AlertCircle className="h-12 w-12 text-rose-500 mb-3" />
              <h3 className="text-white font-semibold text-lg mb-1">Video Playback Error</h3>
              <p className="text-slate-400 text-sm max-w-md mb-4">
                {errorMessage || 'Unable to play this video. The file may be corrupt or codec is unsupported by browser.'}
              </p>
              <button
                onClick={handleRetry}
                className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/30"
              >
                <RefreshCw className="h-4 w-4" />
                Retry Playback
              </button>
            </div>
          ) : (
            <video
              ref={videoRef}
              src={videoSrc}
              controls
              playsInline
              preload="metadata"
              className="h-full w-full object-contain"
              onLoadStart={() => {
                setNetworkStatus('Load started');
                logEvent('loadstart');
              }}
              onLoadedMetadata={() => {
                setIsLoadingMetadata(false);
                setNetworkStatus('Metadata loaded successfully');
                logEvent('loadedmetadata');
              }}
              onCanPlay={() => {
                setNetworkStatus('Ready to play');
                logEvent('canplay');
              }}
              onPlay={() => {
                setIsPlaying(true);
                logEvent('play');
              }}
              onPause={() => {
                setIsPlaying(false);
                logEvent('pause');
              }}
              onWaiting={() => {
                setNetworkStatus('Buffering / Waiting...');
                logEvent('waiting');
              }}
              onStalled={() => {
                setNetworkStatus('Network stalled');
                logEvent('stalled');
              }}
              onError={(e) => {
                const target = e.currentTarget;
                const err = target.error;
                let msg = 'Failed to load or decode video stream.';
                if (err) {
                  switch (err.code) {
                    case 1: msg = 'Fetching video aborted (MEDIA_ERR_ABORTED).'; break;
                    case 2: msg = 'Network error while downloading video (MEDIA_ERR_NETWORK).'; break;
                    case 3: msg = 'Video decoding failed or format unsupported (MEDIA_ERR_DECODE).'; break;
                    case 4: msg = 'Video format/codec not supported by browser (MEDIA_ERR_SRC_NOT_SUPPORTED).'; break;
                  }
                }
                setHasError(true);
                setErrorMessage(msg);
                logEvent(`ERROR: code ${err?.code || 'unknown'} - ${msg}`);
              }}
            />
          )}

          {/* Loading Overlay */}
          {isLoadingMetadata && !hasError && !isYouTube && (
            <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-md border border-slate-700/60 rounded-lg px-3 py-1.5 flex items-center gap-2 text-xs text-slate-200">
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
              <span>Loading video stream...</span>
            </div>
          )}
        </div>

        {/* Diagnostic Debug Panel */}
        {showDebug && !isYouTube && (
          <div className="bg-slate-950 border-t border-slate-800 p-4 font-mono text-xs text-slate-300 max-h-48 overflow-y-auto space-y-2">
            <div className="flex items-center justify-between text-indigo-400 font-bold border-b border-slate-800 pb-1">
              <span>Video Diagnostic Inspector</span>
              <span>Status: {networkStatus}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div><span className="text-slate-500">Video ID:</span> {video.id}</div>
              <div><span className="text-slate-500">Storage Provider:</span> {video.storageProvider || 'local'}</div>
              <div><span className="text-slate-500">Storage Bucket:</span> {video.storageBucket || 'videos'}</div>
              <div><span className="text-slate-500">Storage Path:</span> {video.storagePath || video.path}</div>
              <div><span className="text-slate-500">Playback URL:</span> {videoSrc}</div>
              <div><span className="text-slate-500">Codec / FPS:</span> {video.videoCodec} @ {video.fps} FPS</div>
            </div>
            <div className="border-t border-slate-900 pt-2">
              <p className="text-slate-500 mb-1">Event Timeline:</p>
              <div className="bg-slate-900/80 p-2 rounded border border-slate-800 text-[10px] space-y-0.5">
                {videoEventLog.length === 0 ? (
                  <span className="text-slate-500 italic">Waiting for media events...</span>
                ) : (
                  videoEventLog.map((ev, idx) => <div key={idx}>{ev}</div>)
                )}
              </div>
            </div>
          </div>
        )}

        {/* Info & Properties Bar */}
        <div className="p-6 bg-slate-950/50 flex-1 overflow-y-auto space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-3">
              <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                <Clock className="h-3.5 w-3.5 text-indigo-400" />
                <span>{isYouTubeLive ? 'Live Status' : 'Duration'}</span>
              </div>
              <p className="font-semibold text-sm text-white font-mono">
                {isYouTubeLive ? (
                  <span className="inline-flex items-center gap-1 text-rose-400 font-bold">
                    <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
                    LIVE 24x7
                  </span>
                ) : (
                  formatDuration(video.duration)
                )}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-3">
              <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                <Monitor className="h-3.5 w-3.5 text-emerald-400" />
                <span>Resolution / Stream</span>
              </div>
              <p className="font-semibold text-sm text-white font-mono">
                {isYouTube ? '1080p HD (YouTube)' : `${video.width}×${video.height} (${video.fps} FPS)`}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-3">
              <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                <HardDrive className="h-3.5 w-3.5 text-violet-400" />
                <span>Source Type</span>
              </div>
              <p className="font-semibold text-xs text-white truncate">
                {isYouTubeLive ? 'YouTube Live Stream' : isYouTube ? 'YouTube Video' : video.sourceType === 'IMPORT' ? 'Remote Import' : 'Direct Upload'}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-3">
              <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                <Film className="h-3.5 w-3.5 text-amber-400" />
                <span>Player</span>
              </div>
              <p className="font-semibold text-xs text-white truncate">
                {isYouTube ? 'YouTube Embedded Player' : `${video.videoCodec.toUpperCase()} + ${video.audioCodec?.toUpperCase() || 'AAC'}`}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
            <span className="text-xs text-slate-400">
              {isYouTube ? 'Imported from YouTube' : 'Uploaded'} on {new Date(video.createdAt).toLocaleDateString()} at {new Date(video.createdAt).toLocaleTimeString()}
            </span>
            {onSelectForStream && (
              <button
                onClick={() => {
                  onSelectForStream(video);
                  onClose();
                }}
                className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/25 hover:bg-indigo-500 transition-all"
              >
                <CheckCircle2 className="h-4 w-4" />
                Use Video in Stream
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
