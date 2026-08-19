import React, { useEffect, useState } from 'react';
import {
  Server,
  Radio,
  Sliders,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Loader2,
  ShieldAlert,
} from 'lucide-react';
import { apiFetch } from '../../lib/api.ts';
import { SystemSettings } from '../../types/index.ts';

export const AdminSettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form states
  const [maxConcurrentStreams, setMaxConcurrentStreams] = useState<number>(10);
  const [defaultRtmpUrl, setDefaultRtmpUrl] = useState<string>('rtmp://a.rtmp.youtube.com/live2');
  const [defaultQuality, setDefaultQuality] = useState<string>('source');
  const [defaultBitrate, setDefaultBitrate] = useState<string>('4000k');
  const [maxUploadSizeMb, setMaxUploadSizeMb] = useState<number>(5120);
  const [autoReconnect, setAutoReconnect] = useState<boolean>(true);
  const [reconnectDelay, setReconnectDelay] = useState<number>(5);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const data = await apiFetch<{ settings: SystemSettings }>('/api/admin/settings');
      const s = data.settings;
      setSettings(s);
      setMaxConcurrentStreams(s.maxConcurrentStreams || 10);
      setDefaultRtmpUrl(s.defaultRtmpUrl || 'rtmp://a.rtmp.youtube.com/live2');
      setDefaultQuality(s.defaultQuality || 'source');
      setDefaultBitrate(s.defaultBitrate || '4000k');
      setMaxUploadSizeMb(s.maxUploadSizeMb || 5120);
      setAutoReconnect(s.autoReconnect !== undefined ? s.autoReconnect : true);
      setReconnectDelay(s.reconnectDelay || 5);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to fetch system settings' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setFeedback(null);
    try {
      const res = await apiFetch<{ message: string; settings: SystemSettings }>('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({
          maxConcurrentStreams: Number(maxConcurrentStreams),
          defaultRtmpUrl: defaultRtmpUrl.trim(),
          defaultQuality,
          defaultBitrate,
          maxUploadSizeMb: Number(maxUploadSizeMb),
          autoReconnect: Boolean(autoReconnect),
          reconnectDelay: Number(reconnectDelay),
        }),
      });
      setFeedback({ type: 'success', message: res.message || 'System settings saved successfully.' });
      setSettings(res.settings);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to save system settings' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-white">Global System Settings</h1>
            <span className="rounded-md bg-indigo-500/10 px-2 py-0.5 text-xs font-semibold text-indigo-400 border border-indigo-500/20">
              Administrator Engine Controls
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Global limits, RTMP ingestion defaults, and FFmpeg process policies across the entire server.
          </p>
        </div>

        <button
          onClick={fetchSettings}
          disabled={isLoading}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-300 border border-slate-800 hover:bg-slate-800 hover:text-white transition-all cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
          <span>Reload Settings</span>
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

      {/* Settings Form */}
      <form onSubmit={handleSave} className="space-y-6">
        <div className="rounded-3xl border border-slate-800/80 bg-[#0d121f]/90 p-6 shadow-2xl backdrop-blur-xl space-y-5">
          <div className="flex items-center gap-2">
            <Sliders className="h-4.5 w-4.5 text-indigo-400" />
            <h3 className="text-sm font-bold text-white">Stream & Concurrency Limits</h3>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Max Concurrent Active Streams
              </label>
              <input
                type="number"
                min="1"
                max="50"
                value={maxConcurrentStreams}
                onChange={(e) => setMaxConcurrentStreams(parseInt(e.target.value, 10))}
                className="w-full h-10 rounded-xl bg-slate-900/80 px-3.5 text-xs text-white border border-slate-800 focus:border-indigo-500 focus:outline-none transition-all"
              />
              <p className="text-[11px] text-slate-500 mt-1">Prevents VPS CPU exhaustion from runaway streams.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Default YouTube RTMP URL
              </label>
              <input
                type="text"
                value={defaultRtmpUrl}
                onChange={(e) => setDefaultRtmpUrl(e.target.value)}
                className="w-full h-10 rounded-xl bg-slate-900/80 px-3.5 text-xs text-white font-mono border border-slate-800 focus:border-indigo-500 focus:outline-none transition-all"
              />
              <p className="text-[11px] text-slate-500 mt-1">Standard YouTube Live ingestion endpoint.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Default Output Bitrate
              </label>
              <select
                value={defaultBitrate}
                onChange={(e) => setDefaultBitrate(e.target.value)}
                className="w-full h-10 rounded-xl bg-slate-900/80 px-3.5 text-xs text-white border border-slate-800 focus:border-indigo-500 focus:outline-none transition-all cursor-pointer"
              >
                <option value="2500k">2500 kbps (720p / Lightweight)</option>
                <option value="4000k">4000 kbps (1080p Standard)</option>
                <option value="6000k">6000 kbps (1080p High Quality)</option>
                <option value="8000k">8000 kbps (1080p 60fps)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Max Upload File Size (MB)
              </label>
              <input
                type="number"
                min="100"
                max="20000"
                value={maxUploadSizeMb}
                onChange={(e) => setMaxUploadSizeMb(parseInt(e.target.value, 10))}
                className="w-full h-10 rounded-xl bg-slate-900/80 px-3.5 text-xs text-white border border-slate-800 focus:border-indigo-500 focus:outline-none transition-all"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="autoReconnect"
                checked={autoReconnect}
                onChange={(e) => setAutoReconnect(e.target.checked)}
                className="h-4 w-4 rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="autoReconnect" className="text-xs font-semibold text-white cursor-pointer">
                Enable Automatic FFmpeg Reconnect Policy on Drops
              </label>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              <span>Save System Settings</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
