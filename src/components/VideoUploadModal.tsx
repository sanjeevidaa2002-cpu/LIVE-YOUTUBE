import React, { useState, useRef, useEffect } from 'react';
import {
  UploadCloud,
  X,
  AlertCircle,
  Loader2,
  Film,
  FileVideo,
  Globe,
  CheckCircle2,
  Sparkles,
  Layers,
  Radio,
  ExternalLink,
  Play,
} from 'lucide-react';
import { VideoMetadata } from '../types/index.ts';

interface VideoUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: (video: VideoMetadata) => void;
  onOpenPreview?: (video: VideoMetadata) => void;
}

const SAMPLE_PRESETS = [
  {
    name: 'Big Buck Bunny (1080p 60fps MP4)',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    desc: 'High-quality 1080p standard test video for 24x7 RTMP broadcast loop testing',
    isYouTube: false,
  },
  {
    name: 'Elephants Dream (720p MP4)',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    desc: 'Sci-Fi animation open source movie loop',
    isYouTube: false,
  },
  {
    name: 'Lofi Girl - Relaxing Beats (YouTube Live Sample)',
    url: 'https://www.youtube.com/live/jfKfPfyJRdk',
    desc: '24x7 YouTube Live Stream demo link',
    isYouTube: true,
  },
];

// Helper to detect YouTube ID client-side
function extractYouTubeClient(url: string): { id: string; isLive: boolean } | null {
  if (!url || typeof url !== 'string') return null;
  const clean = url.trim();
  const isLive = /youtube\.com\/live\/[a-zA-Z0-9_-]{11}/i.test(clean) || /[?&]live=1/i.test(clean);
  const patterns = [
    /(?:youtube\.com\/(?:watch\?.*v=|live\/|embed\/|shorts\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i,
    /youtube\.com\/.*[?&]v=([a-zA-Z0-9_-]{11})/i,
  ];
  for (const pattern of patterns) {
    const match = clean.match(pattern);
    if (match && match[1] && /^[a-zA-Z0-9_-]{11}$/.test(match[1])) {
      return { id: match[1], isLive };
    }
  }
  return null;
}

export const VideoUploadModal: React.FC<VideoUploadModalProps> = ({
  isOpen,
  onClose,
  onUploadSuccess,
  onOpenPreview,
}) => {
  const [activeTab, setActiveTab] = useState<'file' | 'url'>('file');
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [currentChunkInfo, setCurrentChunkInfo] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [duplicateVideo, setDuplicateVideo] = useState<VideoMetadata | null>(null);

  // URL Import state
  const [remoteUrl, setRemoteUrl] = useState<string>('');
  const [customName, setCustomName] = useState<string>('');
  const [detectedYt, setDetectedYt] = useState<{ id: string; isLive: boolean } | null>(null);
  const [ytPreview, setYtPreview] = useState<{
    title: string;
    channelTitle: string;
    thumbnailUrl: string;
    liveStatus: string;
    isLiveStream: boolean;
  } | null>(null);
  const [isLoadingYtMeta, setIsLoadingYtMeta] = useState<boolean>(false);

  // Upload Session persistence for fast resumes
  const [activeUploadId, setActiveUploadId] = useState<string | null>(null);
  const [missingChunksCount, setMissingChunksCount] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Detect YouTube URL on remoteUrl changes
  useEffect(() => {
    setDuplicateVideo(null);
    const yt = extractYouTubeClient(remoteUrl);
    setDetectedYt(yt);

    if (yt) {
      setIsLoadingYtMeta(true);
      const timer = setTimeout(async () => {
        try {
          const res = await fetch(`/api/videos/youtube/info?url=${encodeURIComponent(remoteUrl)}`);
          if (res.ok) {
            const data = await res.json();
            if (data.detected) {
              setYtPreview({
                title: data.title,
                channelTitle: data.channelTitle,
                thumbnailUrl: data.thumbnailUrl,
                liveStatus: data.liveStatus,
                isLiveStream: data.isLiveStream,
              });
              if (!customName) {
                setCustomName(data.title);
              }
            }
          }
        } catch {} finally {
          setIsLoadingYtMeta(false);
        }
      }, 400);
      return () => clearTimeout(timer);
    } else {
      setYtPreview(null);
      setIsLoadingYtMeta(false);
    }
  }, [remoteUrl]);

  if (!isOpen) return null;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (selectedFile: File) => {
    setError(null);
    const validExtensions = ['.mp4', '.mkv', '.mov', '.avi', '.flv', '.webm', '.ts'];
    const ext = selectedFile.name.substring(selectedFile.name.lastIndexOf('.')).toLowerCase();

    if (!validExtensions.includes(ext) && !selectedFile.type.startsWith('video/')) {
      setError(`Invalid file format (${ext}). Supported formats: ${validExtensions.join(', ')}`);
      return;
    }

    // 5GB Max size limit
    const maxSize = 5 * 1024 * 1024 * 1024;
    if (selectedFile.size > maxSize) {
      setError('File exceeds maximum upload size (5GB).');
      return;
    }

    setFile(selectedFile);
    setActiveUploadId(null);
    setError(null);
    setMissingChunksCount(null);
  };

  // Helper to upload a single chunk with exponential backoff retries
  const uploadChunkSlice = async (
    targetUploadId: string,
    chunkIndex: number,
    totalChunks: number,
    fileBlob: File,
    chunkSize: number,
    headers: Record<string, string>,
    onChunkProgress?: (loaded: number, total: number) => void
  ): Promise<void> => {
    const start = chunkIndex * chunkSize;
    const end = Math.min(fileBlob.size, start + chunkSize);
    const chunkBlob = fileBlob.slice(start, end);

    let retries = 0;
    const maxRetries = 5;
    let lastErr: Error | null = null;

    while (retries < maxRetries) {
      try {
        const formData = new FormData();
        formData.append('uploadId', targetUploadId);
        formData.append('chunkIndex', String(chunkIndex));
        formData.append('totalChunks', String(totalChunks));
        formData.append('chunk', chunkBlob, `part_${chunkIndex}`);

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', '/api/videos/upload/chunk', true);
          xhr.timeout = 120000; // 2 min timeout per chunk

          Object.entries(headers).forEach(([k, v]) => {
            if (v) xhr.setRequestHeader(k, v);
          });

          if (onChunkProgress) {
            xhr.upload.onprogress = (evt) => {
              if (evt.lengthComputable) {
                onChunkProgress(evt.loaded, evt.total);
              }
            };
          }

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              let msg = `Chunk ${chunkIndex + 1} transfer error (${xhr.status})`;
              try {
                const res = JSON.parse(xhr.responseText);
                if (res.error) msg = res.error;
              } catch {}
              reject(new Error(msg));
            }
          };

          xhr.onerror = () => reject(new Error(`Network interrupted transferring chunk ${chunkIndex + 1}`));
          xhr.ontimeout = () => reject(new Error(`Chunk ${chunkIndex + 1} transfer timed out`));

          xhr.send(formData);
        });

        return; // Success
      } catch (e: any) {
        lastErr = e;
        retries++;
        if (retries < maxRetries) {
          await new Promise((r) => setTimeout(r, retries * 1500));
        }
      }
    }

    throw lastErr || new Error(`Failed to upload chunk ${chunkIndex + 1} after ${maxRetries} attempts.`);
  };

  // Resumable / Chunked Slicing Upload implementation (Immune to 413 Payload Too Large)
  const handleChunkedUpload = async (forceNewSession = false) => {
    if (!file) return;

    setIsUploading(true);
    setError(null);
    setMissingChunksCount(null);
    setUploadProgress(0);

    const token = localStorage.getItem('streamloop_token');
    const authHeaders: Record<string, string> = {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const CHUNK_SIZE = 4 * 1024 * 1024; // 4MB chunks
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    try {
      let uploadId = !forceNewSession ? activeUploadId : null;
      let chunksToUpload: number[] = [];

      // Check if existing session can be resumed
      if (uploadId) {
        setStatusMessage('Checking existing upload session on server...');
        try {
          const statusRes = await fetch(`/api/videos/upload/status/${uploadId}?totalChunks=${totalChunks}`, {
            headers: authHeaders,
          });
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            if (statusData.exists && Array.isArray(statusData.missingChunks)) {
              chunksToUpload = statusData.missingChunks;
              const alreadyUploaded = totalChunks - chunksToUpload.length;
              setUploadProgress(Math.round((alreadyUploaded / totalChunks) * 90));
              setStatusMessage(`Resuming upload: ${alreadyUploaded}/${totalChunks} chunks already on server...`);
            }
          }
        } catch {
          uploadId = null;
        }
      }

      // If no valid session to resume, initialize fresh session
      if (!uploadId || chunksToUpload.length === 0 && !activeUploadId) {
        setStatusMessage('Initializing upload session on VPS...');
        const initRes = await fetch('/api/videos/upload/init', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders,
          },
          body: JSON.stringify({
            originalName: file.name,
            totalChunks,
            totalSize: file.size,
          }),
        });

        if (!initRes.ok) {
          let errMessage = `Upload initialization failed (${initRes.status})`;
          try {
            const initErr = await initRes.json();
            if (initErr.error) errMessage = initErr.error;
          } catch {}
          throw new Error(errMessage);
        }

        const initData = await initRes.json();
        uploadId = initData.uploadId;
        setActiveUploadId(uploadId);
        chunksToUpload = Array.from({ length: totalChunks }, (_, i) => i);
      }

      if (!uploadId) {
        throw new Error('Could not establish upload session ID');
      }

      // Upload required chunk slices
      let completedCount = totalChunks - chunksToUpload.length;

      for (let i = 0; i < chunksToUpload.length; i++) {
        const chunkIndex = chunksToUpload[i];
        setCurrentChunkInfo(`Part ${chunkIndex + 1} of ${totalChunks}`);
        setStatusMessage(`Transferring chunk ${chunkIndex + 1}/${totalChunks}...`);

        await uploadChunkSlice(
          uploadId,
          chunkIndex,
          totalChunks,
          file,
          CHUNK_SIZE,
          authHeaders,
          (loaded, total) => {
            if (total > 0 && totalChunks > 0) {
              const currentChunkFraction = loaded / total;
              const currentOverall = Math.min(
                92,
                Math.round(((completedCount + currentChunkFraction) / totalChunks) * 90)
              );
              setUploadProgress(currentOverall);
            }
          }
        );

        completedCount++;
        const currentOverall = Math.min(92, Math.round((completedCount / totalChunks) * 90));
        setUploadProgress(currentOverall);
      }

      // Step 3: Complete and assemble with Auto-Healing Missing Chunks Loop
      setStatusMessage('Validating video streams with FFprobe & generating thumbnail...');
      setUploadProgress(95);

      let assemblySuccess = false;
      let assemblyAttempts = 0;

      while (!assemblySuccess && assemblyAttempts < 3) {
        assemblyAttempts++;

        const completeRes = await fetch('/api/videos/upload/complete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders,
          },
          body: JSON.stringify({
            uploadId,
            originalName: file.name,
            totalChunks,
          }),
        });

        if (completeRes.ok) {
          const completeData = await completeRes.json();
          setUploadProgress(100);
          setStatusMessage('Upload complete!');
          setIsUploading(false);
          setActiveUploadId(null);
          onUploadSuccess(completeData.video);
          onClose();
          assemblySuccess = true;
          return;
        }

        // Handle possible missing chunk response with automatic self-healing
        let errMsg = `Video assembly failed (${completeRes.status})`;
        let missingList: number[] = [];

        try {
          const completeErr = await completeRes.json();
          if (completeErr.error) errMsg = completeErr.error;
          if (Array.isArray(completeErr.missingChunks) && completeErr.missingChunks.length > 0) {
            missingList = completeErr.missingChunks;
          }
        } catch {}

        if (missingList.length > 0) {
          setMissingChunksCount(missingList.length);
          setStatusMessage(`Auto-healing missing chunk(s) (${missingList.map((n) => n + 1).join(', ')})...`);
          for (const mIdx of missingList) {
            setCurrentChunkInfo(`Healing part ${mIdx + 1} of ${totalChunks}`);
            await uploadChunkSlice(
              uploadId,
              mIdx,
              totalChunks,
              file,
              CHUNK_SIZE,
              authHeaders
            );
          }
          // Continue loop to retry complete
        } else {
          throw new Error(errMsg);
        }
      }

      throw new Error('Video assembly could not verify all chunks after 3 recovery attempts.');
    } catch (err: any) {
      setIsUploading(false);
      const msg = err.message || 'Video upload failed. Please try again.';
      setError(msg.includes('fetch') ? 'Network connection interrupted. Click Resume Upload to continue.' : msg);
    }
  };

  // Remote URL direct import (supports YouTube Live / YouTube Video / Direct MP4)
  const handleUrlImport = async () => {
    if (!remoteUrl || !remoteUrl.startsWith('http')) {
      setError('Please enter a valid HTTP/HTTPS video URL.');
      return;
    }

    setIsUploading(true);
    setError(null);
    setDuplicateVideo(null);
    setUploadProgress(40);
    setStatusMessage(detectedYt ? 'Connecting to YouTube Live stream & registering to Video Library...' : 'Downloading video directly to server & analyzing streams...');

    const token = localStorage.getItem('streamloop_token');
    const authHeaders: Record<string, string> = {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    try {
      const res = await fetch('/api/videos/upload/url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          url: remoteUrl,
          name: customName || undefined,
          isLive: detectedYt?.isLive,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 409) {
        setIsUploading(false);
        setUploadProgress(0);
        setError(data.error || 'This video or live stream is already in your Video Library.');
        if (data.existingVideo) {
          setDuplicateVideo(data.existingVideo);
        }
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || `Failed to import video from URL (${res.status})`);
      }

      setUploadProgress(100);
      setIsUploading(false);
      onUploadSuccess(data.video);
      onClose();
    } catch (err: any) {
      setIsUploading(false);
      const msg = err.message || 'Failed to import video from URL';
      setError(msg.includes('fetch') ? 'Network connection interrupted while importing video.' : msg);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div id="video-upload-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-800 bg-[#0e1320] shadow-2xl overflow-hidden">
        {/* Pinned Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-5 sm:px-6 py-4 shrink-0 bg-[#0e1320]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 shrink-0">
              <UploadCloud className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Add Stream Video</h2>
              <p className="text-xs text-slate-400">Upload video or import YouTube Live stream into your library</p>
            </div>
          </div>
          <button
            id="close-upload-modal-btn"
            onClick={onClose}
            disabled={isUploading}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Selector (pinned under header) */}
        {!isUploading && (
          <div className="px-5 sm:px-6 pt-3 pb-1 shrink-0 bg-[#0e1320]">
            <div className="flex rounded-xl bg-slate-900/80 p-1 border border-slate-800">
              <button
                type="button"
                onClick={() => { setActiveTab('file'); setError(null); setDuplicateVideo(null); }}
                className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition-all ${
                  activeTab === 'file'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileVideo className="h-3.5 w-3.5" />
                <span>Upload Video (File)</span>
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab('url'); setError(null); setDuplicateVideo(null); }}
                className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition-all ${
                  activeTab === 'url'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Globe className="h-3.5 w-3.5" />
                <span>Import Video / YouTube Live</span>
              </button>
            </div>
          </div>
        )}

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-4 custom-scrollbar">
          {activeTab === 'file' ? (
            <>
              {!file ? (
                <div
                  id="dropzone-area"
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all ${
                    isDragging
                      ? 'border-indigo-500 bg-indigo-950/30'
                      : 'border-slate-700/80 bg-slate-900/40 hover:border-slate-600 hover:bg-slate-900/60'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*,.mp4,.mkv,.mov,.avi,.flv,.webm,.ts"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600/10 text-indigo-400 mb-3 border border-indigo-500/20">
                    <FileVideo className="h-7 w-7" />
                  </div>
                  <p className="text-sm font-semibold text-white">
                    Drag and drop your video here, or <span className="text-indigo-400 underline">browse</span>
                  </p>
                  <p className="mt-1.5 text-xs text-slate-400">
                    Supports MP4, MKV, MOV, WEBM, FLV, TS (Up to 5GB chunked upload)
                  </p>
                  <div className="mt-3 flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-400 border border-emerald-500/20">
                    <Layers className="h-3 w-3" />
                    <span>Auto-Chunked 5MB Slicing active (No 413 payload limits)</span>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-950 text-indigo-400 border border-indigo-800/50">
                        <Film className="h-5 w-5" />
                      </div>
                      <div className="overflow-hidden">
                        <p className="truncate text-sm font-semibold text-white">{file.name}</p>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <span>{formatFileSize(file.size)}</span>
                          <span>•</span>
                          <span>{Math.ceil(file.size / (5 * 1024 * 1024))} chunk parts</span>
                        </div>
                      </div>
                    </div>

                    {!isUploading && (
                      <button
                        onClick={() => setFile(null)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-rose-400 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {/* Upload Progress Bar */}
                  {isUploading && (
                    <div className="mt-4 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2 text-indigo-300 font-medium">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          {statusMessage}
                        </span>
                        <div className="flex items-center gap-2">
                          {currentChunkInfo && (
                            <span className="text-[11px] text-slate-400">{currentChunkInfo}</span>
                          )}
                          <span className="font-mono font-bold text-white">{uploadProgress}%</span>
                        </div>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 transition-all duration-300 rounded-full"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Video URL or YouTube Live Link
                  </label>
                  {detectedYt && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      <Radio className="h-2.5 w-2.5 animate-pulse text-rose-400" />
                      {detectedYt.isLive ? 'YouTube Live Stream' : 'YouTube Video'} Detected
                    </span>
                  )}
                </div>
                <input
                  id="remote-url-input"
                  type="url"
                  value={remoteUrl}
                  onChange={(e) => setRemoteUrl(e.target.value)}
                  placeholder="https://www.youtube.com/live/... or https://example.com/video.mp4"
                  disabled={isUploading}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none transition-colors"
                />
              </div>

              {/* YouTube Live Metadata Preview Card */}
              {detectedYt && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-3 flex items-start gap-3">
                  {ytPreview?.thumbnailUrl ? (
                    <img
                      src={ytPreview.thumbnailUrl}
                      alt="Thumbnail"
                      className="w-24 h-14 object-cover rounded-lg border border-slate-800 shrink-0"
                    />
                  ) : (
                    <div className="w-24 h-14 bg-slate-800 rounded-lg flex items-center justify-center shrink-0">
                      {isLoadingYtMeta ? (
                        <Loader2 className="h-5 w-5 text-slate-400 animate-spin" />
                      ) : (
                        <Radio className="h-6 w-6 text-rose-400" />
                      )}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-600 text-white uppercase tracking-wider">
                        <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
                        {detectedYt.isLive ? 'Live Stream' : 'YouTube'}
                      </span>
                      {ytPreview?.channelTitle && (
                        <span className="text-[11px] text-slate-400 truncate">
                          {ytPreview.channelTitle}
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-semibold text-white truncate mt-1">
                      {ytPreview?.title || customName || `YouTube Stream (${detectedYt.id})`}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Ready to import directly to Video Library without transcoding.
                    </p>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Video Display Name (Optional)
                </label>
                <input
                  id="custom-name-input"
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="e.g. 24x7 Chill Lo-fi Stream Loop"
                  disabled={isUploading}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* Sample Presets */}
              <div className="mt-2 space-y-2">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-indigo-400">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Or Choose Quick Test Sample / Preset:</span>
                </p>
                <div className="space-y-1.5">
                  {SAMPLE_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setRemoteUrl(preset.url);
                        setCustomName(preset.name);
                      }}
                      className="w-full text-left rounded-xl border border-slate-800 bg-slate-900/40 p-2.5 hover:border-indigo-500/50 hover:bg-slate-900 transition-all text-xs flex items-center justify-between"
                    >
                      <div>
                        <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                          {preset.isYouTube && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-600/80 text-white">
                              YT LIVE
                            </span>
                          )}
                          {preset.name}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{preset.desc}</div>
                      </div>
                      <ExternalLink className="h-3.5 w-3.5 text-slate-500 ml-2 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>

              {isUploading && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-indigo-300 font-medium">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      {statusMessage}
                    </span>
                    <span className="font-mono font-bold text-white">{uploadProgress}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300 rounded-full"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="rounded-xl bg-rose-500/10 p-3.5 text-xs text-rose-400 border border-rose-500/30 space-y-2.5">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{error}</span>
              </div>

              {activeTab === 'file' && file && !isUploading && (
                <div className="flex items-center gap-2 pt-1">
                  {activeUploadId && (
                    <button
                      type="button"
                      onClick={() => handleChunkedUpload(false)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-colors"
                    >
                      <UploadCloud className="h-3.5 w-3.5" />
                      <span>Resume & Re-upload Missing Chunks</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleChunkedUpload(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
                  >
                    <span>Restart Fresh Upload</span>
                  </button>
                </div>
              )}

              {duplicateVideo && onOpenPreview && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenPreview(duplicateVideo);
                  }}
                  className="flex items-center gap-1.5 mt-1 px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-semibold transition-colors"
                >
                  <Play className="h-3.5 w-3.5" />
                  <span>Open Video in Library</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Pinned Footer Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-800 px-5 sm:px-6 py-3.5 bg-[#0e1320] shrink-0">
          <button
            id="cancel-upload-btn"
            onClick={onClose}
            disabled={isUploading}
            className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800 hover:text-white transition-colors disabled:opacity-50"
          >
            Cancel
          </button>

          {activeTab === 'file' ? (
            <button
              id="start-chunked-upload-btn"
              onClick={handleChunkedUpload}
              disabled={!file || isUploading}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Uploading Chunks...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="h-3.5 w-3.5" />
                  <span>Start Upload</span>
                </>
              )}
            </button>
          ) : (
            <button
              id="import-url-btn"
              onClick={handleUrlImport}
              disabled={!remoteUrl || isUploading}
              className={`flex items-center gap-2 rounded-xl px-5 py-2 text-xs font-semibold text-white shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none ${
                detectedYt
                  ? 'bg-rose-600 shadow-rose-600/30 hover:bg-rose-500'
                  : 'bg-indigo-600 shadow-indigo-600/30 hover:bg-indigo-500'
              }`}
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Importing...</span>
                </>
              ) : (
                <>
                  {detectedYt ? <Radio className="h-3.5 w-3.5" /> : <Globe className="h-3.5 w-3.5" />}
                  <span>{detectedYt ? (detectedYt.isLive ? 'Import YouTube Live' : 'Import YouTube Video') : 'Import Video'}</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
