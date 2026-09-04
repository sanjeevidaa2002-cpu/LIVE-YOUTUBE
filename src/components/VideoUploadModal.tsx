import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  Plus,
  RefreshCw,
  Clock,
  Trash2,
  Check,
} from 'lucide-react';
import { VideoMetadata } from '../types/index.ts';

interface VideoUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: (video: VideoMetadata) => void;
  onOpenPreview?: (video: VideoMetadata) => void;
}

export type UploadItemStatus =
  | 'idle'
  | 'queued'
  | 'uploading'
  | 'assembling'
  | 'completed'
  | 'error'
  | 'canceled';

export interface UploadQueueItem {
  id: string;
  file: File;
  originalName: string;
  size: number;
  status: UploadItemStatus;
  progress: number;
  statusMessage: string;
  currentChunkInfo?: string;
  uploadId?: string | null;
  error?: string | null;
  uploadedVideo?: VideoMetadata;
  xhr?: XMLHttpRequest | null;
  validationError?: string | null;
}

const MAX_CONCURRENT_UPLOADS = 3;
const CHUNK_SIZE = 4 * 1024 * 1024; // 4MB chunks
const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024; // 5GB limit
const VALID_EXTENSIONS = ['.mp4', '.mkv', '.mov', '.avi', '.flv', '.webm', '.ts'];

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
  const [queue, setQueue] = useState<UploadQueueItem[]>([]);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

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
  const [isUrlImporting, setIsUrlImporting] = useState<boolean>(false);
  const [urlImportProgress, setUrlImportProgress] = useState<number>(0);
  const [urlStatusMessage, setUrlStatusMessage] = useState<string>('');
  const [duplicateVideo, setDuplicateVideo] = useState<VideoMetadata | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const queueRef = useRef<UploadQueueItem[]>([]);
  const activeUploadsCountRef = useRef<number>(0);
  const isProcessingQueueRef = useRef<boolean>(false);

  // Keep queueRef in sync with queue state
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

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

  const updateItem = useCallback((id: string, updates: Partial<UploadQueueItem>) => {
    setQueue((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  }, []);

  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Add multiple files to the upload queue
  const addFilesToQueue = (files: FileList | File[]) => {
    setGeneralError(null);
    if (!files || files.length === 0) return;

    const newItems: UploadQueueItem[] = [];

    Array.from(files).forEach((selectedFile, index) => {
      const ext = selectedFile.name.substring(selectedFile.name.lastIndexOf('.')).toLowerCase();
      const isValidExt = VALID_EXTENSIONS.includes(ext) || selectedFile.type.startsWith('video/');
      const isValidSize = selectedFile.size <= MAX_FILE_SIZE && selectedFile.size > 0;

      let validationError: string | null = null;
      if (!isValidExt) {
        validationError = `Unsupported format (${ext || 'unknown'}). Supported: ${VALID_EXTENSIONS.join(', ')}`;
      } else if (!isValidSize) {
        validationError = selectedFile.size === 0 ? 'File is empty (0 Bytes)' : 'File exceeds maximum 5GB limit';
      }

      // Check if duplicate is already in queue with identical name and size
      const isDuplicate = queueRef.current.some(
        (item) => item.originalName === selectedFile.name && item.size === selectedFile.size
      );

      if (!isDuplicate) {
        newItems.push({
          id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 7)}_${index}`,
          file: selectedFile,
          originalName: selectedFile.name,
          size: selectedFile.size,
          status: validationError ? 'error' : 'idle',
          progress: 0,
          statusMessage: validationError || 'Ready to upload',
          validationError,
        });
      }
    });

    if (newItems.length > 0) {
      setQueue((prev) => [...prev, ...newItems]);
    }

    // Reset input value so re-selecting same files works reliably
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

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
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFilesToQueue(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFilesToQueue(e.target.files);
    }
  };

  // Helper to upload a single chunk with retries
  const uploadChunkSlice = async (
    targetUploadId: string,
    chunkIndex: number,
    totalChunks: number,
    fileBlob: File,
    chunkSize: number,
    headers: Record<string, string>,
    itemId: string,
    onChunkProgress?: (loaded: number, total: number) => void
  ): Promise<void> => {
    const start = chunkIndex * chunkSize;
    const end = Math.min(fileBlob.size, start + chunkSize);
    const chunkBlob = fileBlob.slice(start, end);

    let retries = 0;
    const maxRetries = 4;
    let lastErr: Error | null = null;

    while (retries < maxRetries) {
      // Check if user canceled item
      const currentItem = queueRef.current.find((i) => i.id === itemId);
      if (!currentItem || currentItem.status === 'canceled') {
        throw new Error('Upload canceled by user');
      }

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

          xhr.onerror = () => reject(new Error(`Network interrupted on chunk ${chunkIndex + 1}`));
          xhr.ontimeout = () => reject(new Error(`Chunk ${chunkIndex + 1} transfer timed out`));

          // Store xhr on item for clean cancellation
          updateItem(itemId, { xhr });
          xhr.send(formData);
        });

        return; // Success
      } catch (e: any) {
        lastErr = e;
        if (e.message?.includes('canceled')) throw e;
        retries++;
        if (retries < maxRetries) {
          await new Promise((r) => setTimeout(r, retries * 1200));
        }
      }
    }

    throw lastErr || new Error(`Failed to upload chunk ${chunkIndex + 1} after ${maxRetries} attempts.`);
  };

  // Upload a single queue item from start to finish
  const uploadSingleItem = async (itemId: string): Promise<void> => {
    const item = queueRef.current.find((i) => i.id === itemId);
    if (!item || item.status === 'canceled' || item.status === 'completed') return;

    updateItem(itemId, {
      status: 'uploading',
      progress: 1,
      statusMessage: 'Initializing session on server...',
      error: null,
    });

    const token = localStorage.getItem('streamloop_token');
    const authHeaders: Record<string, string> = {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const totalChunks = Math.ceil(item.file.size / CHUNK_SIZE);

    try {
      // Step 1: Initialize session on server
      const initRes = await fetch('/api/videos/upload/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          originalName: item.file.name,
          totalChunks,
          totalSize: item.file.size,
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
      const uploadId = initData.uploadId;
      updateItem(itemId, { uploadId });

      // Step 2: Upload all chunks
      let completedCount = 0;
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        // Check for cancellation
        const freshItem = queueRef.current.find((i) => i.id === itemId);
        if (!freshItem || freshItem.status === 'canceled') {
          throw new Error('Upload canceled by user');
        }

        updateItem(itemId, {
          currentChunkInfo: `Part ${chunkIndex + 1} of ${totalChunks}`,
          statusMessage: `Transferring part ${chunkIndex + 1}/${totalChunks}...`,
        });

        await uploadChunkSlice(
          uploadId,
          chunkIndex,
          totalChunks,
          item.file,
          CHUNK_SIZE,
          authHeaders,
          itemId,
          (loaded, total) => {
            if (total > 0 && totalChunks > 0) {
              const currentFraction = loaded / total;
              const overall = Math.min(92, Math.round(((completedCount + currentFraction) / totalChunks) * 90));
              updateItem(itemId, { progress: overall });
            }
          }
        );

        completedCount++;
        const overall = Math.min(92, Math.round((completedCount / totalChunks) * 90));
        updateItem(itemId, { progress: overall });
      }

      // Step 3: Complete & verify final storage
      updateItem(itemId, {
        status: 'assembling',
        progress: 95,
        statusMessage: 'Validating video with FFprobe & generating thumbnail...',
      });

      let completeSuccess = false;
      let attempts = 0;

      while (!completeSuccess && attempts < 3) {
        attempts++;
        const completeRes = await fetch('/api/videos/upload/complete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders,
          },
          body: JSON.stringify({
            uploadId,
            originalName: item.file.name,
            totalChunks,
          }),
        });

        if (completeRes.ok) {
          const completeData = await completeRes.json();
          updateItem(itemId, {
            status: 'completed',
            progress: 100,
            statusMessage: 'Uploaded successfully',
            uploadedVideo: completeData.video,
            xhr: null,
          });

          onUploadSuccess(completeData.video);
          // Broadcast global event so all page views refresh
          window.dispatchEvent(new CustomEvent('streamloop:videos-updated', { detail: completeData.video }));
          completeSuccess = true;
          return;
        }

        // Handle auto-healing missing chunks
        let errMsg = `Server assembly failed (${completeRes.status})`;
        let missingList: number[] = [];
        try {
          const completeErr = await completeRes.json();
          if (completeErr.error) errMsg = completeErr.error;
          if (Array.isArray(completeErr.missingChunks) && completeErr.missingChunks.length > 0) {
            missingList = completeErr.missingChunks;
          }
        } catch {}

        if (missingList.length > 0) {
          updateItem(itemId, {
            statusMessage: `Auto-healing missing chunk(s) (${missingList.map((n) => n + 1).join(', ')})...`,
          });
          for (const mIdx of missingList) {
            await uploadChunkSlice(
              uploadId,
              mIdx,
              totalChunks,
              item.file,
              CHUNK_SIZE,
              authHeaders,
              itemId
            );
          }
        } else {
          throw new Error(errMsg);
        }
      }

      throw new Error('Video assembly could not verify all chunks after 3 attempts.');
    } catch (err: any) {
      if (err.message?.includes('canceled')) {
        updateItem(itemId, {
          status: 'canceled',
          statusMessage: 'Upload canceled',
          xhr: null,
        });
      } else {
        const msg = err.message || 'Upload failed';
        updateItem(itemId, {
          status: 'error',
          error: msg,
          statusMessage: msg.includes('fetch') ? 'Network connection interrupted' : msg,
          xhr: null,
        });
      }
    }
  };

  // Queue runner enforcing MAX_CONCURRENT_UPLOADS concurrency
  const processQueue = useCallback(() => {
    if (isProcessingQueueRef.current) return;
    isProcessingQueueRef.current = true;

    try {
      const currentQueue = queueRef.current;
      const activeCount = currentQueue.filter(
        (i) => i.status === 'uploading' || i.status === 'assembling'
      ).length;
      activeUploadsCountRef.current = activeCount;

      const availableSlots = MAX_CONCURRENT_UPLOADS - activeCount;
      if (availableSlots <= 0) return;

      const queuedItems = currentQueue.filter((i) => i.status === 'queued');
      const itemsToStart = queuedItems.slice(0, availableSlots);

      for (const item of itemsToStart) {
        // Mark as uploading immediately to avoid double dispatch
        updateItem(item.id, { status: 'uploading', statusMessage: 'Starting upload...' });

        // Run upload in background
        (async () => {
          try {
            await uploadSingleItem(item.id);
          } finally {
            // Trigger next queue processing step
            setTimeout(() => {
              isProcessingQueueRef.current = false;
              processQueue();
            }, 50);
          }
        })();
      }
    } finally {
      isProcessingQueueRef.current = false;
    }
  }, [updateItem]);

  // Start uploading all idle and error items in queue
  const handleStartAllUploads = () => {
    setGeneralError(null);
    setQueue((prev) =>
      prev.map((item) => {
        if (item.status === 'idle' || item.status === 'error' || item.status === 'canceled') {
          return {
            ...item,
            status: 'queued',
            error: null,
            progress: 0,
            statusMessage: 'Waiting in upload queue...',
          };
        }
        return item;
      })
    );

    setTimeout(() => {
      processQueue();
    }, 50);
  };

  // Retry a single failed item
  const handleRetryItem = (id: string) => {
    updateItem(id, {
      status: 'queued',
      error: null,
      progress: 0,
      statusMessage: 'Waiting in upload queue...',
    });

    setTimeout(() => {
      processQueue();
    }, 50);
  };

  // Cancel an active upload or remove item from queue
  const handleCancelOrRemoveItem = (id: string) => {
    const item = queueRef.current.find((i) => i.id === id);
    if (!item) return;

    if (item.status === 'uploading' || item.status === 'assembling') {
      if (item.xhr) {
        try {
          item.xhr.abort();
        } catch {}
      }
      updateItem(id, {
        status: 'canceled',
        statusMessage: 'Upload canceled',
        xhr: null,
      });
      // Slot freed, trigger next queue item
      setTimeout(() => {
        processQueue();
      }, 50);
    } else {
      // Remove entirely from list if not actively uploading
      setQueue((prev) => prev.filter((i) => i.id !== id));
    }
  };

  // Clear completed items from queue
  const handleClearCompleted = () => {
    setQueue((prev) => prev.filter((i) => i.status !== 'completed'));
  };

  // Remote URL direct import (YouTube Live / YouTube Video / Direct MP4)
  const handleUrlImport = async () => {
    if (!remoteUrl || !remoteUrl.startsWith('http')) {
      setGeneralError('Please enter a valid HTTP/HTTPS video URL.');
      return;
    }

    setIsUrlImporting(true);
    setGeneralError(null);
    setDuplicateVideo(null);
    setUrlImportProgress(40);
    setUrlStatusMessage(
      detectedYt
        ? 'Connecting to YouTube Live stream & registering to Video Library...'
        : 'Downloading video directly to server & analyzing streams...'
    );

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
        setIsUrlImporting(false);
        setUrlImportProgress(0);
        setGeneralError(data.error || 'This video or live stream is already in your Video Library.');
        if (data.existingVideo) {
          setDuplicateVideo(data.existingVideo);
        }
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || `Failed to import video from URL (${res.status})`);
      }

      setUrlImportProgress(100);
      setIsUrlImporting(false);
      onUploadSuccess(data.video);
      window.dispatchEvent(new CustomEvent('streamloop:videos-updated', { detail: data.video }));
      onClose();
    } catch (err: any) {
      setIsUrlImporting(false);
      const msg = err.message || 'Failed to import video from URL';
      setGeneralError(msg.includes('fetch') ? 'Network connection interrupted while importing video.' : msg);
    }
  };

  if (!isOpen) return null;

  // Compute overall queue statistics
  const totalCount = queue.length;
  const idleCount = queue.filter((i) => i.status === 'idle').length;
  const queuedCount = queue.filter((i) => i.status === 'queued').length;
  const uploadingCount = queue.filter((i) => i.status === 'uploading' || i.status === 'assembling').length;
  const completedCount = queue.filter((i) => i.status === 'completed').length;
  const errorCount = queue.filter((i) => i.status === 'error').length;
  const isAnyUploading = uploadingCount > 0 || queuedCount > 0;
  const isAllCompleted = totalCount > 0 && completedCount === totalCount;

  return (
    <div
      id="video-upload-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4 overflow-y-auto"
    >
      <div className="relative w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl border border-slate-800 bg-[#0e1320] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Pinned Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-5 sm:px-6 py-4 shrink-0 bg-[#0e1320]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 shrink-0">
              <UploadCloud className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white">Multiple Video Upload</h2>
                <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-300 border border-indigo-500/20">
                  <Layers className="h-2.5 w-2.5" />
                  3x Concurrent
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Select and upload multiple videos simultaneously with independent progress tracking
              </p>
            </div>
          </div>
          <button
            id="close-upload-modal-btn"
            onClick={onClose}
            disabled={isAnyUploading || isUrlImporting}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Selector (Upload Files vs URL / YouTube) */}
        {!isAnyUploading && !isUrlImporting && (
          <div className="px-5 sm:px-6 pt-3 pb-1 shrink-0 bg-[#0e1320]">
            <div className="flex rounded-xl bg-slate-900/80 p-1 border border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('file');
                  setGeneralError(null);
                  setDuplicateVideo(null);
                }}
                className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition-all ${
                  activeTab === 'file'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileVideo className="h-3.5 w-3.5" />
                <span>Upload Videos ({queue.length})</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('url');
                  setGeneralError(null);
                  setDuplicateVideo(null);
                }}
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
              {/* Hidden multi-file input */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="video/*,.mp4,.mkv,.mov,.avi,.flv,.webm,.ts"
                onChange={handleFileChange}
                className="hidden"
              />

              {/* If Queue is Empty: Show Big Dropzone */}
              {queue.length === 0 ? (
                <div
                  id="dropzone-area"
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all ${
                    isDragging
                      ? 'border-indigo-500 bg-indigo-950/30 scale-[0.99]'
                      : 'border-slate-700/80 bg-slate-900/40 hover:border-slate-600 hover:bg-slate-900/60'
                  }`}
                >
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600/10 text-indigo-400 mb-3.5 border border-indigo-500/20 shadow-inner">
                    <UploadCloud className="h-8 w-8" />
                  </div>
                  <p className="text-sm sm:text-base font-semibold text-white">
                    Select Multiple Videos or Drag & Drop Here
                  </p>
                  <p className="mt-1 text-xs text-slate-400 max-w-md">
                    Select one or multiple files at once. Supports MP4, MKV, MOV, WEBM, FLV, TS (up to 5GB per file).
                  </p>
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500/10 px-3 py-1.5 text-xs font-semibold text-indigo-300 border border-indigo-500/20">
                      <Plus className="h-3.5 w-3.5" />
                      Click to Select Multiple Videos
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 px-2.5 py-1.5 text-xs font-medium text-emerald-400 border border-emerald-500/20">
                      <Layers className="h-3 w-3" />
                      Auto-Chunked 4MB Slicing
                    </span>
                  </div>
                </div>
              ) : (
                /* Upload Queue Management View */
                <div className="space-y-3.5">
                  {/* Queue Header Controls */}
                  <div className="flex flex-wrap items-center justify-between gap-2.5 bg-slate-900/70 border border-slate-800 p-3 rounded-xl">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white uppercase tracking-wider">
                        Upload Queue ({completedCount}/{totalCount} Completed)
                      </span>
                      {uploadingCount > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 animate-pulse">
                          <Loader2 className="h-2.5 w-2.5 animate-spin" />
                          {uploadingCount} Uploading
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        id="add-more-videos-btn"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all active:scale-95 shadow-sm"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>+ Add More Videos</span>
                      </button>

                      {completedCount > 0 && !isAnyUploading && (
                        <button
                          type="button"
                          onClick={handleClearCompleted}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
                        >
                          Clear Completed
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Queue Item List */}
                  <div className="space-y-2.5 max-h-[46vh] overflow-y-auto pr-1 custom-scrollbar">
                    {queue.map((item, idx) => (
                      <div
                        key={item.id}
                        id={`upload-item-${item.id}`}
                        className={`rounded-xl border p-3.5 transition-all ${
                          item.status === 'completed'
                            ? 'border-emerald-500/30 bg-emerald-950/10'
                            : item.status === 'error'
                            ? 'border-rose-500/40 bg-rose-950/15'
                            : item.status === 'uploading' || item.status === 'assembling'
                            ? 'border-indigo-500/40 bg-indigo-950/20 ring-1 ring-indigo-500/20'
                            : 'border-slate-800 bg-slate-900/50 hover:bg-slate-900/80'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          {/* Left: Index, Icon & Filename */}
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            <div
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-xs font-bold ${
                                item.status === 'completed'
                                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                  : item.status === 'error'
                                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                                  : item.status === 'uploading' || item.status === 'assembling'
                                  ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/30'
                                  : 'bg-slate-800 text-slate-400 border-slate-700'
                              }`}
                            >
                              {item.status === 'completed' ? (
                                <Check className="h-4 w-4" />
                              ) : item.status === 'error' ? (
                                <AlertCircle className="h-4 w-4" />
                              ) : item.status === 'uploading' || item.status === 'assembling' ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <span>{idx + 1}</span>
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs sm:text-sm font-semibold text-white">
                                {item.originalName}
                              </p>
                              <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                                <span>{formatFileSize(item.size)}</span>
                                <span>•</span>
                                <span>{Math.ceil(item.size / CHUNK_SIZE)} chunk parts</span>
                              </div>
                            </div>
                          </div>

                          {/* Right: Status Badge & Actions */}
                          <div className="flex items-center gap-2 shrink-0">
                            {/* Status Badge */}
                            {item.status === 'idle' && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-300 border border-slate-700">
                                Ready
                              </span>
                            )}
                            {item.status === 'queued' && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300 border border-amber-500/30">
                                <Clock className="h-2.5 w-2.5" />
                                Queued
                              </span>
                            )}
                            {item.status === 'uploading' && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-indigo-500/20 px-2 py-0.5 text-[10px] font-semibold text-indigo-300 border border-indigo-500/30">
                                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                Uploading
                              </span>
                            )}
                            {item.status === 'assembling' && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-purple-500/20 px-2 py-0.5 text-[10px] font-semibold text-purple-300 border border-purple-500/30">
                                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                Validating
                              </span>
                            )}
                            {item.status === 'completed' && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 border border-emerald-500/30">
                                <CheckCircle2 className="h-2.5 w-2.5" />
                                Uploaded
                              </span>
                            )}
                            {item.status === 'error' && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/20 px-2 py-0.5 text-[10px] font-semibold text-rose-300 border border-rose-500/30">
                                <AlertCircle className="h-2.5 w-2.5" />
                                Failed
                              </span>
                            )}
                            {item.status === 'canceled' && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-400 border border-slate-700">
                                Canceled
                              </span>
                            )}

                            {/* Item Action Buttons */}
                            {item.status === 'error' && !item.validationError && (
                              <button
                                type="button"
                                onClick={() => handleRetryItem(item.id)}
                                className="flex items-center gap-1 px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold transition-colors"
                              >
                                <RefreshCw className="h-3 w-3" />
                                <span>Retry</span>
                              </button>
                            )}

                            {item.status !== 'completed' && (
                              <button
                                type="button"
                                onClick={() => handleCancelOrRemoveItem(item.id)}
                                title={item.status === 'uploading' ? 'Cancel Upload' : 'Remove from Queue'}
                                className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-rose-400 transition-colors"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Progress Bar & Status Message */}
                        {(item.status === 'uploading' ||
                          item.status === 'assembling' ||
                          item.status === 'completed' ||
                          item.status === 'error' ||
                          item.status === 'queued') && (
                          <div className="mt-2.5 space-y-1.5">
                            <div className="flex items-center justify-between text-[11px]">
                              <span
                                className={`truncate font-medium ${
                                  item.status === 'error'
                                    ? 'text-rose-400'
                                    : item.status === 'completed'
                                    ? 'text-emerald-400'
                                    : 'text-indigo-300'
                                }`}
                              >
                                {item.statusMessage}
                              </span>
                              <div className="flex items-center gap-2 shrink-0 ml-2">
                                {item.currentChunkInfo && (
                                  <span className="text-[10px] text-slate-400">{item.currentChunkInfo}</span>
                                )}
                                <span className="font-mono font-bold text-white">{item.progress}%</span>
                              </div>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                              <div
                                className={`h-full transition-all duration-300 rounded-full ${
                                  item.status === 'completed'
                                    ? 'bg-emerald-500'
                                    : item.status === 'error'
                                    ? 'bg-rose-500'
                                    : 'bg-gradient-to-r from-indigo-500 to-purple-500'
                                }`}
                                style={{ width: `${item.progress}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Drop more area below queue */}
                  {!isAnyUploading && (
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className="border border-dashed border-slate-700 hover:border-indigo-500/50 bg-slate-900/30 hover:bg-slate-900/60 rounded-xl p-3 text-center cursor-pointer transition-all flex items-center justify-center gap-2 text-xs text-slate-400"
                    >
                      <Plus className="h-3.5 w-3.5 text-indigo-400" />
                      <span>Drag more videos here or click to add</span>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            /* Tab 2: URL & YouTube Import */
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
                  disabled={isUrlImporting}
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
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-red-600 text-white uppercase tracking-wider">
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
                  disabled={isUrlImporting}
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

              {isUrlImporting && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-indigo-300 font-medium">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      {urlStatusMessage}
                    </span>
                    <span className="font-mono font-bold text-white">{urlImportProgress}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300 rounded-full"
                      style={{ width: `${urlImportProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* General Error Banner */}
          {generalError && (
            <div className="rounded-xl bg-rose-500/10 p-3.5 text-xs text-rose-400 border border-rose-500/30 space-y-2">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{generalError}</span>
              </div>

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
        <div className="flex items-center justify-between gap-3 border-t border-slate-800 px-5 sm:px-6 py-3.5 bg-[#0e1320] shrink-0">
          <div className="text-xs text-slate-400">
            {activeTab === 'file' && queue.length > 0 && (
              <span>
                {completedCount === totalCount
                  ? `${totalCount} of ${totalCount} videos uploaded`
                  : `${completedCount} of ${totalCount} uploaded`}
                {errorCount > 0 && ` • ${errorCount} failed`}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              id="cancel-upload-btn"
              onClick={onClose}
              disabled={isAnyUploading || isUrlImporting}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800 hover:text-white transition-colors disabled:opacity-50"
            >
              {isAllCompleted ? 'Close' : 'Cancel'}
            </button>

            {activeTab === 'file' ? (
              queue.length === 0 ? (
                <button
                  id="select-videos-btn"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition-all active:scale-95"
                >
                  <UploadCloud className="h-3.5 w-3.5" />
                  <span>Select Videos</span>
                </button>
              ) : isAllCompleted ? (
                <button
                  id="all-uploaded-done-btn"
                  onClick={onClose}
                  className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 transition-all active:scale-95"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{totalCount} Videos Uploaded Successfully — Done</span>
                </button>
              ) : (
                <button
                  id="start-chunked-upload-btn"
                  onClick={handleStartAllUploads}
                  disabled={isAnyUploading || (idleCount === 0 && errorCount === 0)}
                  className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                >
                  {isAnyUploading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Uploading {completedCount + 1} of {totalCount}...</span>
                    </>
                  ) : errorCount > 0 && idleCount === 0 ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>Retry {errorCount} Failed Videos</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="h-3.5 w-3.5" />
                      <span>Upload {idleCount > 0 ? idleCount : totalCount} Videos</span>
                    </>
                  )}
                </button>
              )
            ) : (
              <button
                id="import-url-btn"
                onClick={handleUrlImport}
                disabled={!remoteUrl || isUrlImporting}
                className={`flex items-center gap-2 rounded-xl px-5 py-2 text-xs font-semibold text-white shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none ${
                  detectedYt
                    ? 'bg-rose-600 shadow-rose-600/30 hover:bg-rose-500'
                    : 'bg-indigo-600 shadow-indigo-600/30 hover:bg-indigo-500'
                }`}
              >
                {isUrlImporting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Importing...</span>
                  </>
                ) : (
                  <>
                    {detectedYt ? <Radio className="h-3.5 w-3.5" /> : <Globe className="h-3.5 w-3.5" />}
                    <span>
                      {detectedYt
                        ? detectedYt.isLive
                          ? 'Import YouTube Live'
                          : 'Import YouTube Video'
                        : 'Import Video'}
                    </span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
