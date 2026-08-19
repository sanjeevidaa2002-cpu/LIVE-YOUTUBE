import React, { useEffect, useState } from 'react';
import {
  HardDrive,
  CheckCircle2,
  RefreshCw,
  Trash2,
  Folder,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { apiFetch } from '../../lib/api.ts';
import { StorageStatusResponse } from '../../types/index.ts';

export const AdminStoragePage: React.FC = () => {
  const [storageStatus, setStorageStatus] = useState<StorageStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isPurging, setIsPurging] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchStatus = async () => {
    setIsLoading(true);
    try {
      const data = await apiFetch<StorageStatusResponse>('/api/storage/status');
      setStorageStatus(data);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to fetch storage status' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handlePurgeCache = async () => {
    if (!confirm('Purge all temporary stream segments on VPS?')) return;
    setIsPurging(true);
    setFeedback(null);
    try {
      const res = await apiFetch<{ message: string }>('/api/storage/cache/purge', { method: 'POST' });
      setFeedback({ type: 'success', message: res.message || 'Cache purged successfully' });
      await fetchStatus();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to purge cache' });
    } finally {
      setIsPurging(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-white">VPS Server Storage Management</h1>
            <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
              Admin Only
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Monitor local server video storage, uploads directory, and stream cache.
          </p>
        </div>

        <button
          onClick={fetchStatus}
          disabled={isLoading}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-300 border border-slate-800 hover:bg-slate-800 hover:text-white transition-all cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
          <span>Refresh Status</span>
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

      {/* Storage Status Card */}
      <div className="rounded-3xl border border-slate-800/80 bg-[#0d121f]/90 p-6 shadow-2xl backdrop-blur-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <HardDrive className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Local Disk Storage Status</h2>
              <p className="text-xs text-slate-400">Primary server storage backend for video files and streams</p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold border bg-emerald-950/40 text-emerald-400 border-emerald-800/40">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>ACTIVE & PERSISTENT</span>
          </span>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 rounded-2xl bg-slate-950/60 p-4 border border-slate-800/60 text-xs">
          <div>
            <span className="text-slate-500 text-[11px] block">Storage Backend</span>
            <span className="font-semibold text-white">VPS Local Filesystem</span>
          </div>
          <div>
            <span className="text-slate-500 text-[11px] block">Storage Directory</span>
            <span className="font-mono text-indigo-400 truncate block">
              {storageStatus?.location || '/uploads'}
            </span>
          </div>
          <div>
            <span className="text-slate-500 text-[11px] block">Cached Segments</span>
            <span className="font-semibold text-slate-300">
              {storageStatus?.cacheStats?.totalCachedFiles || 0} files ({storageStatus?.cacheStats?.totalSizeBytes ? Math.round(storageStatus.cacheStats.totalSizeBytes / 1024 / 1024) : 0} MB)
            </span>
          </div>
        </div>
      </div>

      {/* Storage Actions */}
      <div className="rounded-3xl border border-slate-800/80 bg-[#0d121f]/90 p-6 shadow-2xl backdrop-blur-xl space-y-4">
        <div className="flex items-center gap-2">
          <Folder className="h-4.5 w-4.5 text-indigo-400" />
          <h3 className="text-sm font-bold text-white">Cache & Maintenance</h3>
        </div>

        <p className="text-xs text-slate-400">
          Clean temporary FFmpeg stream buffer files and cached segments to reclaim VPS disk space.
        </p>

        <div className="pt-2 flex items-center justify-between border-t border-slate-800/80">
          <span className="text-xs text-slate-400">Reclaim temporary disk storage</span>
          <button
            type="button"
            onClick={handlePurgeCache}
            disabled={isPurging}
            className="inline-flex items-center gap-2 rounded-xl bg-rose-950/40 px-4 py-2 text-xs font-semibold text-rose-300 border border-rose-800/40 hover:bg-rose-900/60 transition-all cursor-pointer disabled:opacity-50"
          >
            {isPurging ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            <span>Purge Stream Cache</span>
          </button>
        </div>
      </div>
    </div>
  );
};
