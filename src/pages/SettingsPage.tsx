import React, { useState, useEffect, useMemo } from 'react';
import {
  Settings,
  Save,
  Lock,
  Sliders,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  HardDrive,
  Key,
  Cloud,
  FolderSync,
  Trash2,
  ShieldCheck,
  Eye,
  EyeOff,
  Radio,
  FileVideo,
  Folder,
  XCircle,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Youtube,
} from 'lucide-react';
import { SystemSettings, StorageStatusInfo, StreamStatus } from '../types/index.ts';
import { apiFetch } from '../lib/api.ts';

function formatBytes(bytes: number, decimals = 2): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

// Client-side helper to preview normalized Drive ID
function extractDrivePreview(input: string): { id: string; type: string } {
  if (!input || !input.trim()) return { id: '', type: 'none' };
  const raw = input.trim();
  const folderMatch = raw.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch && folderMatch[1]) return { id: folderMatch[1], type: 'folder' };
  const fileMatch = raw.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch && fileMatch[1]) return { id: fileMatch[1], type: 'file' };
  const idQueryMatch = raw.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idQueryMatch && idQueryMatch[1]) return { id: idQueryMatch[1], type: 'id' };
  if (/^[a-zA-Z0-9_-]{10,80}$/.test(raw)) return { id: raw, type: 'id' };
  return { id: raw, type: 'raw' };
}

export const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<SystemSettings>({
    defaultRtmpUrl: 'rtmps://a.rtmp.youtube.com:443/live2',
    defaultQuality: 'source',
    defaultBitrate: '4000k',
    defaultFps: 'source',
    autoReconnect: true,
    reconnectDelay: 5,
    maxUploadSizeMb: 500,
    allowedExtensions: ['.mp4', '.mkv', '.mov', '.avi', '.flv', '.webm', '.ts'],
    autoRecoverOnBoot: true,
    maxConcurrentStreams: 5,
    adminGoogleEmails: ['lightgaming4m@gmail.com'],
    googleDriveEnabled: true,
    googleDriveFolderId: '',
    googleDriveApiKey: '',
    googleDriveLocation: '',
  });

  // Storage states
  const [storageStatus, setStorageStatus] = useState<StorageStatusInfo | null>(null);
  const [streamStatus, setStreamStatus] = useState<StreamStatus | null>(null);
  const [driveApiKeyInput, setDriveApiKeyInput] = useState<string>('');
  const [driveLocationInput, setDriveLocationInput] = useState<string>('');
  const [showApiKey, setShowApiKey] = useState<boolean>(false);

  // Operation flags & messages
  const [isSavingStorage, setIsSavingStorage] = useState<boolean>(false);
  const [isTestingDrive, setIsTestingDrive] = useState<boolean>(false);
  const [isSyncingDrive, setIsSyncingDrive] = useState<boolean>(false);
  const [isClearingCache, setIsClearingCache] = useState<boolean>(false);
  const [isClearingStorage, setIsClearingStorage] = useState<boolean>(false);

  const [storageAlert, setStorageAlert] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
    details?: {
      locationStatus?: 'VALID' | 'NOT_ACCESSIBLE';
      folderName?: string;
      locationType?: string;
    };
  } | null>(null);

  const [cacheClearMessage, setCacheClearMessage] = useState<{ success: boolean; message: string } | null>(null);

  // General settings state
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Password change states
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [passwordStatus, setPasswordStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState<boolean>(false);

  // YouTube Cookies & Bot Protection State
  const [cookiesInfo, setCookiesInfo] = useState<{
    configured: boolean;
    cookieCount: number;
    fileSize: number;
    updatedAt?: string;
  }>({
    configured: false,
    cookieCount: 0,
    fileSize: 0,
  });
  const [cookiesInput, setCookiesInput] = useState<string>('');
  const [isSavingCookies, setIsSavingCookies] = useState<boolean>(false);
  const [isTestingCookies, setIsTestingCookies] = useState<boolean>(false);
  const [isClearingCookies, setIsClearingCookies] = useState<boolean>(false);
  const [cookiesAlert, setCookiesAlert] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  const loadCookiesStatus = async () => {
    try {
      const res = await apiFetch<{ cookies: { configured: boolean; cookieCount: number; fileSize: number; updatedAt?: string } }>('/api/settings/cookies');
      if (res.cookies) {
        setCookiesInfo(res.cookies);
      }
    } catch (err: any) {
      console.warn('Could not fetch cookies status:', err);
    }
  };

  const handleSaveCookies = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cookiesInput.trim()) {
      setCookiesAlert({ type: 'error', message: 'Please paste your cookies.txt or JSON cookie data.' });
      return;
    }

    setIsSavingCookies(true);
    setCookiesAlert(null);
    try {
      const res = await apiFetch<{ success: boolean; message: string; cookies: any }>('/api/settings/cookies', {
        method: 'POST',
        body: JSON.stringify({ cookiesContent: cookiesInput }),
      });
      setCookiesAlert({ type: 'success', message: res.message || 'YouTube cookies saved and verified!' });
      if (res.cookies) {
        setCookiesInfo(res.cookies);
      }
      setCookiesInput('');
    } catch (err: any) {
      setCookiesAlert({ type: 'error', message: err.message || 'Failed to save cookies' });
    } finally {
      setIsSavingCookies(false);
    }
  };

  const handleTestCookies = async () => {
    setIsTestingCookies(true);
    setCookiesAlert(null);
    try {
      const res = await apiFetch<{ success: boolean; message: string }>('/api/settings/cookies/test', {
        method: 'POST',
      });
      setCookiesAlert({ type: 'success', message: res.message || 'Cookies verified successfully against YouTube!' });
      loadCookiesStatus();
    } catch (err: any) {
      setCookiesAlert({ type: 'error', message: err.message || 'YouTube rejected cookies' });
    } finally {
      setIsTestingCookies(false);
    }
  };

  const handleClearCookies = async () => {
    if (!window.confirm('Remove saved YouTube cookies? yt-dlp will fall back to anonymous and oEmbed access.')) return;
    setIsClearingCookies(true);
    setCookiesAlert(null);
    try {
      const res = await apiFetch<{ success: boolean; message: string; cookies: any }>('/api/settings/cookies', {
        method: 'DELETE',
      });
      setCookiesAlert({ type: 'info', message: res.message || 'YouTube cookies removed.' });
      if (res.cookies) {
        setCookiesInfo(res.cookies);
      }
    } catch (err: any) {
      setCookiesAlert({ type: 'error', message: err.message || 'Failed to delete cookies' });
    } finally {
      setIsClearingCookies(false);
    }
  };

  const loadStorageStatus = async () => {
    try {
      const res = await apiFetch<StorageStatusInfo>('/api/settings/storage');
      setStorageStatus(res);
      if (res.location) {
        setDriveLocationInput(res.location);
      } else if (res.folderId) {
        setDriveLocationInput(res.folderId);
      }
    } catch (err: any) {
      console.warn('Could not fetch storage status:', err);
    }
  };

  const loadStreamStatus = async () => {
    try {
      const res = await apiFetch<{ status: StreamStatus }>('/api/stream/status');
      if (res.status) {
        setStreamStatus(res.status);
      }
    } catch {
      // silent fallback
    }
  };

  useEffect(() => {
    Promise.all([
      apiFetch<{ settings: SystemSettings }>('/api/settings').then((res) => {
        if (res.settings) {
          setSettings(res.settings);
          if (res.settings.googleDriveLocation) {
            setDriveLocationInput(res.settings.googleDriveLocation);
          } else if (res.settings.googleDriveFolderId) {
            setDriveLocationInput(res.settings.googleDriveFolderId);
          }
        }
      }),
      loadStorageStatus(),
      loadStreamStatus(),
      loadCookiesStatus(),
    ])
      .catch((err) => setGeneralError(err.message || 'Failed to load settings'))
      .finally(() => setIsLoading(false));
  }, []);

  const locationPreview = useMemo(() => {
    return extractDrivePreview(driveLocationInput);
  }, [driveLocationInput]);

  // SAVE GOOGLE DRIVE STORAGE SETTINGS
  const handleSaveStorageSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSavingStorage(true);
    setStorageAlert(null);

    try {
      const res = await apiFetch<{
        success: boolean;
        message: string;
        configured: boolean;
        apiKeyMasked?: string;
        location?: string;
        folderId?: string;
      }>('/api/settings/storage', {
        method: 'POST',
        body: JSON.stringify({
          provider: 'google_drive',
          apiKey: driveApiKeyInput || undefined,
          location: driveLocationInput.trim(),
        }),
      });

      setStorageAlert({
        type: 'success',
        message: res.message || 'Google Drive storage configuration saved.',
      });

      setDriveApiKeyInput('');
      await loadStorageStatus();
    } catch (err: any) {
      setStorageAlert({
        type: 'error',
        message: err.message || 'Failed to save Google Drive storage settings.',
      });
    } finally {
      setIsSavingStorage(false);
    }
  };

  // TEST GOOGLE DRIVE CONNECTION
  const handleTestDriveConnection = async () => {
    setIsTestingDrive(true);
    setStorageAlert(null);

    try {
      const res = await apiFetch<{
        success: boolean;
        provider: string;
        status: 'CONNECTED' | 'FAILED';
        locationStatus: 'VALID' | 'NOT_ACCESSIBLE';
        message: string;
        folderName?: string;
        locationType?: string;
      }>('/api/settings/storage/test', {
        method: 'POST',
        body: JSON.stringify({
          apiKey: driveApiKeyInput || undefined,
          location: driveLocationInput.trim() || undefined,
        }),
      });

      setStorageAlert({
        type: res.success ? 'success' : 'error',
        message: res.message,
        details: {
          locationStatus: res.locationStatus,
          folderName: res.folderName,
          locationType: res.locationType,
        },
      });

      await loadStorageStatus();
    } catch (err: any) {
      setStorageAlert({
        type: 'error',
        message: err.message || 'Connection test to Google Drive failed.',
        details: {
          locationStatus: 'NOT_ACCESSIBLE',
        },
      });
    } finally {
      setIsTestingDrive(false);
    }
  };

  // CLEAR GOOGLE DRIVE SETTINGS
  const handleClearStorageSettings = async () => {
    if (!window.confirm('Are you sure you want to clear the Google Drive storage configuration?')) {
      return;
    }

    setIsClearingStorage(true);
    setStorageAlert(null);

    try {
      await apiFetch('/api/settings/storage', { method: 'DELETE' });
      setDriveApiKeyInput('');
      setDriveLocationInput('');
      setStorageAlert({
        type: 'info',
        message: 'Google Drive storage settings have been reset.',
      });
      await loadStorageStatus();
    } catch (err: any) {
      setStorageAlert({
        type: 'error',
        message: err.message || 'Failed to reset storage configuration.',
      });
    } finally {
      setIsClearingStorage(false);
    }
  };

  // SYNC LIBRARY
  const handleSyncDriveVideos = async () => {
    setIsSyncingDrive(true);
    setStorageAlert(null);
    try {
      const res = await apiFetch<{
        success: boolean;
        message: string;
        newCount: number;
        updatedCount: number;
      }>('/api/settings/storage/sync', {
        method: 'POST',
        body: JSON.stringify({ location: driveLocationInput.trim() || undefined }),
      });
      setStorageAlert({
        type: 'success',
        message: res.message || `Sync completed (${res.newCount} new videos, ${res.updatedCount} updated).`,
      });
      await loadStorageStatus();
    } catch (err: any) {
      setStorageAlert({
        type: 'error',
        message: err.message || 'Sync failed. Ensure your Google Drive is accessible.',
      });
    } finally {
      setIsSyncingDrive(false);
    }
  };

  // CLEAR STREAM CACHE
  const handleClearCache = async () => {
    setIsClearingCache(true);
    setCacheClearMessage(null);
    try {
      const res = await apiFetch<{ message: string; deletedCount: number }>('/api/storage/cache/clear', {
        method: 'POST',
      });
      setCacheClearMessage({
        success: true,
        message: res.message || 'VPS Stream cache purged successfully.',
      });
      await loadStorageStatus();
    } catch (err: any) {
      setCacheClearMessage({
        success: false,
        message: err.message || 'Failed to clear stream cache',
      });
    } finally {
      setIsClearingCache(false);
    }
  };

  // SAVE STREAM SETTINGS
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    setGeneralError(null);

    try {
      const res = await apiFetch<{ settings: SystemSettings }>('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      });
      if (res.settings) {
        setSettings(res.settings);
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err: any) {
      setGeneralError(err.message || 'Failed to update settings');
    } finally {
      setIsSaving(false);
    }
  };

  // CHANGE PASSWORD
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordStatus({ success: false, message: 'New passwords do not match' });
      return;
    }

    setIsChangingPassword(true);
    setPasswordStatus(null);

    try {
      await apiFetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setPasswordStatus({ success: true, message: 'Password updated successfully!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordStatus(null), 4000);
    } catch (err: any) {
      setPasswordStatus({ success: false, message: err.message || 'Failed to change password' });
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-sky-500" />
      </div>
    );
  }

  const isDriveConnected = storageStatus?.status === 'READY';
  const isStreamLive = streamStatus === 'LIVE' || streamStatus === 'STARTING';

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-16">
      {/* Header & Navigation Path */}
      <div>
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
          <span>Admin Panel</span>
          <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
          <span>Settings</span>
          <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
          <span className="text-sky-400">Storage</span>
          <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
          <span className="text-white">Google Drive</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">System Settings & Storage</h1>
        <p className="text-xs text-slate-400 mt-1">
          Configure Google Drive video storage, YouTube RTMP streaming defaults, and server security.
        </p>
      </div>

      {generalError && (
        <div className="flex items-center gap-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 p-4 text-xs text-rose-400">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{generalError}</span>
        </div>
      )}

      {saveSuccess && (
        <div className="flex items-center gap-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4 text-xs text-emerald-400">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span>System settings updated successfully!</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. GOOGLE DRIVE STORAGE CONFIGURATION (SIMPLIFIED & DIRECT)               */}
      {/* ========================================================================= */}
      <div className="rounded-2xl border border-sky-900/40 bg-[#0c1424] p-6 shadow-xl space-y-6">
        {/* Section Header with Independent Status Badges */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
              <Cloud className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-base font-bold text-white">Google Drive Storage</h2>
                <span className="rounded-md bg-sky-950/80 border border-sky-800/60 px-2 py-0.5 text-[10px] font-semibold text-sky-300">
                  Primary Storage
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Direct Google Drive integration for 24×7 video library and cloud streaming.
              </p>
            </div>
          </div>

          {/* Live Status Indicators (Google Drive & YouTube Stream strictly independent) */}
          <div className="flex items-center gap-2 flex-wrap pt-2 sm:pt-0">
            {/* Google Drive Status */}
            <div
              className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold border ${
                isDriveConnected
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : storageStatus?.isConfigured
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                  : 'bg-slate-900 border-slate-700 text-slate-400'
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  isDriveConnected
                    ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                    : storageStatus?.isConfigured
                    ? 'bg-rose-400 shadow-[0_0_8px_rgba(248,113,113,0.8)]'
                    : 'bg-slate-500'
                }`}
              />
              <span>
                Google Drive: {isDriveConnected ? 'Connected' : storageStatus?.isConfigured ? 'Connection Failed' : 'Not Configured'}
              </span>
            </div>

            {/* YouTube Stream Status */}
            <div
              className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold border ${
                isStreamLive
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-slate-900 border-slate-700 text-slate-400'
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  isStreamLive
                    ? 'bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                    : 'bg-slate-500'
                }`}
              />
              <span>YouTube Stream: {isStreamLive ? 'Live' : 'Stopped'}</span>
            </div>
          </div>
        </div>



        {/* Feedback / Alert Banner */}
        {storageAlert && (
          <div
            className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl p-3.5 text-xs border ${
              storageAlert.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                : storageAlert.type === 'info'
                ? 'bg-sky-500/10 text-sky-300 border-sky-500/30'
                : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {storageAlert.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              ) : storageAlert.type === 'info' ? (
                <ShieldCheck className="h-4 w-4 shrink-0 text-sky-400" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              )}
              <span className="font-medium">{storageAlert.message}</span>
            </div>

            {storageAlert.details && (
              <div className="flex items-center gap-2 shrink-0">
                {storageAlert.details.locationStatus && (
                  <span
                    className={`rounded-md px-2 py-0.5 font-mono text-[11px] font-bold uppercase ${
                      storageAlert.details.locationStatus === 'VALID'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                        : 'bg-rose-950 text-rose-300 border border-rose-700'
                    }`}
                  >
                    Location: {storageAlert.details.locationStatus}
                  </span>
                )}
                {storageAlert.details.folderName && (
                  <span className="rounded-md bg-slate-900 px-2 py-0.5 font-mono text-[11px] text-slate-300 border border-slate-700">
                    {storageAlert.details.folderName}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* The 2 Core Configuration Fields Form */}
        <form onSubmit={handleSaveStorageSettings} className="space-y-5">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {/* Field 1: Google Drive API Key */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <Key className="h-3.5 w-3.5 text-sky-400" />
                  <span>Google Drive API Key</span>
                  <span className="text-[10px] text-slate-400 font-normal">(Optional if signed in)</span>
                </label>
                {storageStatus?.apiKeyConfigured && !driveApiKeyInput && (
                  <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Configured ({storageStatus.apiKeyMasked})
                  </span>
                )}
              </div>

              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={driveApiKeyInput}
                  onChange={(e) => setDriveApiKeyInput(e.target.value)}
                  placeholder={
                    storageStatus?.apiKeyConfigured
                      ? '•••••••••••••••••••••••••••• (Leave blank to keep existing)'
                      : 'AIzaSy...'
                  }
                  className="w-full rounded-xl bg-slate-950 px-3.5 py-2.5 pr-10 text-xs text-white border border-slate-800 font-mono focus:border-sky-500 focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                  title={showApiKey ? 'Hide API key' : 'Show API key'}
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                Google Cloud API Key with Google Drive API enabled.
              </p>
            </div>

            {/* Field 2: Google Drive File / Folder Location */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <Folder className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Google Drive File / Folder Location</span>
                </label>
                {storageStatus?.folderName && (
                  <span className="text-[11px] font-mono text-sky-400 truncate max-w-[200px]">
                    {storageStatus.folderName}
                  </span>
                )}
              </div>

              <input
                type="text"
                value={driveLocationInput}
                onChange={(e) => setDriveLocationInput(e.target.value)}
                placeholder="e.g. 1AbCdEfGhIjKlMnOp or https://drive.google.com/drive/folders/1AbCdEf..."
                className="w-full rounded-xl bg-slate-950 px-3.5 py-2.5 text-xs text-white border border-slate-800 font-mono focus:border-sky-500 focus:outline-none transition-colors"
                required
              />

              {/* Real-time normalization preview */}
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Accepts Folder URL, File URL, or direct ID.</span>
                {locationPreview.id && (
                  <span className="font-mono text-sky-300">
                    ID: <strong className="text-white">{locationPreview.id}</strong>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/80">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Test Connection Button */}
              <button
                type="button"
                onClick={handleTestDriveConnection}
                disabled={isTestingDrive}
                className="flex items-center gap-2 rounded-xl bg-sky-600/20 border border-sky-500/30 px-4 py-2.5 text-xs font-semibold text-sky-300 hover:bg-sky-600/30 transition-all active:scale-95 disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isTestingDrive ? 'animate-spin' : ''}`} />
                <span>{isTestingDrive ? 'Testing Connection...' : 'TEST CONNECTION'}</span>
              </button>

              {/* Sync Video Library Button */}
              <button
                type="button"
                onClick={handleSyncDriveVideos}
                disabled={isSyncingDrive || !storageStatus?.isConfigured}
                className="flex items-center gap-2 rounded-xl bg-indigo-600/20 border border-indigo-500/30 px-4 py-2.5 text-xs font-semibold text-indigo-300 hover:bg-indigo-600/30 transition-all active:scale-95 disabled:opacity-50"
              >
                <FolderSync className={`h-3.5 w-3.5 ${isSyncingDrive ? 'animate-spin' : ''}`} />
                <span>{isSyncingDrive ? 'Syncing...' : 'SYNC LIBRARY'}</span>
              </button>

              {/* Clear Settings Button */}
              {storageStatus?.isConfigured && (
                <button
                  type="button"
                  onClick={handleClearStorageSettings}
                  disabled={isClearingStorage}
                  className="flex items-center gap-1.5 rounded-xl bg-rose-600/10 border border-rose-500/20 px-3.5 py-2.5 text-xs font-semibold text-rose-300 hover:bg-rose-600/20 transition-all active:scale-95 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>{isClearingStorage ? 'Clearing...' : 'CLEAR SETTINGS'}</span>
                </button>
              )}
            </div>

            {/* Save Settings Button */}
            <button
              type="submit"
              disabled={isSavingStorage}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-600/25 hover:from-sky-400 hover:to-indigo-500 transition-all active:scale-95 disabled:opacity-50"
            >
              {isSavingStorage ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              <span>SAVE SETTINGS</span>
            </button>
          </div>
        </form>

        {/* VPS Temporary Stream Cache Monitor */}
        <div className="rounded-xl bg-slate-950/70 border border-slate-800/80 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <HardDrive className="h-4 w-4 text-violet-400" />
              <div>
                <span className="text-xs font-bold text-white">VPS Temporary Streaming Cache</span>
                <p className="text-[11px] text-slate-400">
                  Google Drive videos are temporarily cached on VPS disk during active FFmpeg playback.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-slate-300">
                {storageStatus?.cacheStats?.count || 0} video(s) ({formatBytes(storageStatus?.cacheStats?.totalSizeBytes || 0)})
              </span>
              <button
                type="button"
                onClick={handleClearCache}
                disabled={isClearingCache || !storageStatus?.cacheStats?.count}
                className="flex items-center gap-1.5 rounded-lg bg-rose-600/10 border border-rose-500/20 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-600/20 disabled:opacity-40 transition-all"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>{isClearingCache ? 'Purging...' : 'Purge Cache'}</span>
              </button>
            </div>
          </div>
          {cacheClearMessage && (
            <p className="text-[11px] text-emerald-400 mt-2 font-medium">{cacheClearMessage.message}</p>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. YOUTUBE RTMP STREAM CONFIGURATION DEFAULTS                           */}
      {/* ========================================================================= */}
      <form onSubmit={handleSaveSettings} className="space-y-6">
        <div className="rounded-2xl border border-slate-800 bg-[#0d121f] p-6 shadow-lg space-y-5">
          <div className="flex items-center gap-2.5 border-b border-slate-800/80 pb-3">
            <Sliders className="h-5 w-5 text-indigo-400" />
            <h2 className="text-sm font-bold text-white">Stream Configuration Defaults</h2>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-300">Default YouTube RTMP/RTMPS Server URL</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, defaultRtmpUrl: 'rtmps://a.rtmp.youtube.com:443/live2' })}
                    className="text-[10px] text-emerald-400 font-semibold hover:underline"
                  >
                    Primary RTMPS (Port 443)
                  </button>
                  <span className="text-slate-600 text-[10px]">•</span>
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, defaultRtmpUrl: 'rtmps://b.rtmp.youtube.com:443/live2?backup=1' })}
                    className="text-[10px] text-indigo-400 hover:underline"
                  >
                    Backup RTMPS
                  </button>
                  <span className="text-slate-600 text-[10px]">•</span>
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, defaultRtmpUrl: 'rtmp://a.rtmp.youtube.com/live2' })}
                    className="text-[10px] text-slate-400 hover:underline"
                  >
                    RTMP (Port 1935)
                  </button>
                </div>
              </div>
              <input
                type="text"
                value={settings.defaultRtmpUrl}
                onChange={(e) => setSettings({ ...settings, defaultRtmpUrl: e.target.value })}
                className="w-full rounded-xl bg-slate-950 px-3.5 py-2.5 text-xs text-white border border-slate-800 font-mono focus:border-indigo-500 focus:outline-none"
              />
              <p className="text-[11px] text-slate-400">
                YouTube Live recommends secure <strong>RTMPS (Port 443)</strong> for continuous 24×7 streaming.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Default Output Quality</label>
              <select
                value={settings.defaultQuality}
                onChange={(e) => setSettings({ ...settings, defaultQuality: e.target.value as any })}
                className="w-full rounded-xl bg-slate-950 px-3 py-2 text-xs text-white border border-slate-800 focus:border-indigo-500 focus:outline-none"
              >
                <option value="source">Source Quality</option>
                <option value="1080p">1080p Full HD</option>
                <option value="720p">720p HD</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Default Video Bitrate</label>
              <select
                value={settings.defaultBitrate}
                onChange={(e) => setSettings({ ...settings, defaultBitrate: e.target.value })}
                className="w-full rounded-xl bg-slate-950 px-3 py-2 text-xs text-white border border-slate-800 focus:border-indigo-500 focus:outline-none"
              >
                <option value="auto">Auto</option>
                <option value="2500k">2500 kbps</option>
                <option value="4000k">4000 kbps</option>
                <option value="6000k">6000 kbps</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Default FPS</label>
              <select
                value={settings.defaultFps}
                onChange={(e) => setSettings({ ...settings, defaultFps: e.target.value as any })}
                className="w-full rounded-xl bg-slate-950 px-3 py-2 text-xs text-white border border-slate-800 focus:border-indigo-500 focus:outline-none"
              >
                <option value="source">Source FPS</option>
                <option value="30">30 FPS</option>
                <option value="60">60 FPS</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Reconnect Delay (Seconds)</label>
              <input
                type="number"
                min="2"
                max="60"
                value={settings.reconnectDelay}
                onChange={(e) => setSettings({ ...settings, reconnectDelay: Number(e.target.value) })}
                className="w-full rounded-xl bg-slate-950 px-3 py-2 text-xs text-white border border-slate-800 focus:border-indigo-500 focus:outline-none font-mono"
              />
            </div>
          </div>

          {/* Recovery Options */}
          <div className="pt-3 border-t border-slate-800/80 space-y-3">
            <div className="flex items-start gap-3 rounded-xl border border-indigo-500/20 bg-indigo-950/20 p-3.5">
              <div className="h-2 w-2 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
              <div>
                <p className="text-xs font-bold text-white">Manual Start Only (Auto-Start Disabled)</p>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  The stream is strictly configured to start ONLY when you click &quot;Start Stream&quot;. Page reloads, server boots, and app visits will never start streaming automatically.
                </p>
              </div>
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.autoReconnect}
                onChange={(e) => setSettings({ ...settings, autoReconnect: e.target.checked })}
                className="h-4 w-4 rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-0"
              />
              <div>
                <p className="text-xs font-bold text-white">Automatic Stream Reconnection</p>
                <p className="text-[11px] text-slate-400">
                  Continuously retry connecting to YouTube RTMP if network connection drops
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Upload Limits */}
        <div className="rounded-2xl border border-slate-800 bg-[#0d121f] p-6 shadow-lg space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-800/80 pb-3">
            <HardDrive className="h-5 w-5 text-violet-400" />
            <h2 className="text-sm font-bold text-white">Storage & Upload Constraints</h2>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Maximum Video Upload Size (MB)</label>
              <input
                type="number"
                min="50"
                max="5000"
                value={settings.maxUploadSizeMb}
                onChange={(e) => setSettings({ ...settings, maxUploadSizeMb: Number(e.target.value) })}
                className="w-full rounded-xl bg-slate-950 px-3.5 py-2.5 text-xs text-white border border-slate-800 font-mono focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Allowed Video File Formats</label>
              <p className="text-xs text-slate-400 font-mono py-2.5">
                {settings.allowedExtensions?.join(', ') || '.mp4, .mkv, .mov, .webm'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition-all active:scale-95 disabled:opacity-50"
          >
            {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            <span>Save System Defaults</span>
          </button>
        </div>
      </form>

      {/* ========================================================================= */}
      {/* 3. YOUTUBE AUTHENTICATION & BOT VERIFICATION                             */}
      {/* ========================================================================= */}
      <div className="rounded-2xl border border-slate-800 bg-[#0d121f] p-6 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-600/20 text-red-400 border border-red-500/30 shrink-0">
              <Youtube className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span>YouTube Authentication & Bot Protection</span>
                {cookiesInfo.configured ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="h-3 w-3" />
                    Active ({cookiesInfo.cookieCount} cookies)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-400 border border-slate-700">
                    Optional / Not Configured
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                Authenticate server requests to YouTube to prevent "Sign in to confirm you're not a bot" errors.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {cookiesInfo.configured && (
              <>
                <button
                  type="button"
                  onClick={handleTestCookies}
                  disabled={isTestingCookies}
                  className="flex items-center gap-1.5 rounded-xl bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white border border-slate-700 hover:bg-slate-700 transition-all disabled:opacity-50"
                  title="Test cookies with YouTube"
                >
                  <RefreshCw className={`h-3 w-3 ${isTestingCookies ? 'animate-spin' : ''}`} />
                  <span>Test Connection</span>
                </button>
                <button
                  type="button"
                  onClick={handleClearCookies}
                  disabled={isClearingCookies}
                  className="flex items-center gap-1.5 rounded-xl bg-rose-950/40 px-3 py-1.5 text-xs font-semibold text-rose-300 border border-rose-800/60 hover:bg-rose-900/60 transition-all disabled:opacity-50"
                  title="Remove saved cookies"
                >
                  <Trash2 className="h-3 w-3" />
                  <span>Clear</span>
                </button>
              </>
            )}
          </div>
        </div>

        {cookiesAlert && (
          <div
            className={`flex items-center gap-2 rounded-xl p-3 text-xs border ${
              cookiesAlert.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : cookiesAlert.type === 'info'
                ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
            }`}
          >
            {cookiesAlert.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : cookiesAlert.type === 'info' ? (
              <ShieldCheck className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span>{cookiesAlert.message}</span>
          </div>
        )}

        <form onSubmit={handleSaveCookies} className="space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <Key className="h-3.5 w-3.5 text-red-400" />
                <span>Exported YouTube Cookies (Netscape format or JSON)</span>
              </label>
              {cookiesInfo.updatedAt && (
                <span className="text-[11px] font-mono text-slate-400">
                  Updated: {new Date(cookiesInfo.updatedAt).toLocaleTimeString()}
                </span>
              )}
            </div>
            <textarea
              rows={4}
              value={cookiesInput}
              onChange={(e) => setCookiesInput(e.target.value)}
              placeholder="# Netscape HTTP Cookie File (paste content from Get cookies.txt extension or Cookie-Editor JSON)&#10;.youtube.com&#9;TRUE&#9;/&#9;TRUE&#9;1799999999&#9;LOGIN_INFO&#9;..."
              className="w-full rounded-xl bg-slate-950 px-3.5 py-2.5 text-xs text-slate-200 border border-slate-800 font-mono focus:border-red-500 focus:outline-none transition-colors placeholder:text-slate-600"
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <HelpCircle className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span>
                Tip: Install <strong>Get cookies.txt LOCALLY</strong> or <strong>Cookie-Editor</strong> in your browser, open youtube.com, export cookies, and paste here.
              </span>
            </div>

            <button
              type="submit"
              disabled={isSavingCookies || !cookiesInput.trim()}
              className="flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-red-600/30 hover:bg-red-500 transition-all disabled:opacity-50 active:scale-95"
            >
              {isSavingCookies ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              <span>Save & Apply Cookies</span>
            </button>
          </div>
        </form>
      </div>

      {/* ========================================================================= */}
      {/* 4. ADMIN PASSWORD CHANGE                                                */}
      {/* ========================================================================= */}
      <form onSubmit={handleChangePassword} className="rounded-2xl border border-slate-800 bg-[#0d121f] p-6 shadow-lg space-y-4">
        <div className="flex items-center gap-2.5 border-b border-slate-800/80 pb-3">
          <Lock className="h-5 w-5 text-amber-400" />
          <h2 className="text-sm font-bold text-white">Change Admin Password</h2>
        </div>

        {passwordStatus && (
          <div
            className={`flex items-center gap-2 rounded-xl p-3 text-xs border ${
              passwordStatus.success
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
            }`}
          >
            {passwordStatus.success ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
            <span>{passwordStatus.message}</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl bg-slate-950 px-3.5 py-2 text-xs text-white border border-slate-800 focus:border-indigo-500 focus:outline-none"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl bg-slate-950 px-3.5 py-2 text-xs text-white border border-slate-800 focus:border-indigo-500 focus:outline-none"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl bg-slate-950 px-3.5 py-2 text-xs text-white border border-slate-800 focus:border-indigo-500 focus:outline-none"
              required
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isChangingPassword}
            className="flex items-center gap-2 rounded-xl bg-slate-800 px-5 py-2 text-xs font-semibold text-white border border-slate-700 hover:bg-slate-700 transition-all disabled:opacity-50"
          >
            <Key className="h-3.5 w-3.5" />
            <span>Update Password</span>
          </button>
        </div>
      </form>
    </div>
  );
};
