import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  Plus,
  Trash2,
  Lock,
  CheckCircle2,
  AlertCircle,
  Mail,
  Loader2,
} from 'lucide-react';
import { apiFetch } from '../../lib/api.ts';

export const AdminSecurityPage: React.FC = () => {
  const [adminEmails, setAdminEmails] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchSecurity = async () => {
    setIsLoading(true);
    try {
      const data = await apiFetch<{ adminGoogleEmails: string[] }>('/api/admin/security');
      setAdminEmails(data.adminGoogleEmails || []);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to fetch security settings' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSecurity();
  }, []);

  const handleAddEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newEmail.includes('@')) {
      setFeedback({ type: 'error', message: 'Please enter a valid Google email address.' });
      return;
    }

    const clean = newEmail.trim().toLowerCase();
    if (adminEmails.includes(clean)) {
      setFeedback({ type: 'error', message: 'Email is already in administrator allowlist.' });
      return;
    }

    const updated = [...adminEmails, clean];
    await saveEmailList(updated);
    setNewEmail('');
  };

  const handleRemoveEmail = async (emailToRemove: string) => {
    if (adminEmails.length <= 1) {
      setFeedback({ type: 'error', message: 'Cannot remove the only administrator email.' });
      return;
    }
    const updated = adminEmails.filter((e) => e !== emailToRemove);
    await saveEmailList(updated);
  };

  const saveEmailList = async (list: string[]) => {
    setIsSaving(true);
    setFeedback(null);
    try {
      const res = await apiFetch<{ message: string; adminGoogleEmails: string[] }>('/api/admin/security', {
        method: 'PUT',
        body: JSON.stringify({ adminGoogleEmails: list }),
      });
      setAdminEmails(res.adminGoogleEmails);
      setFeedback({ type: 'success', message: 'Admin Google email allowlist updated successfully.' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to save admin emails' });
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
            <h1 className="text-2xl font-bold tracking-tight text-white">Security & Administrator Access</h1>
            <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
              Access Control
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Google accounts authorized to access the Admin Panel and manage the VPS.
          </p>
        </div>
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

      {/* Admin Email List Card */}
      <div className="rounded-3xl border border-slate-800/80 bg-[#0d121f]/90 p-6 shadow-2xl backdrop-blur-xl space-y-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-emerald-400" />
          <h2 className="text-base font-bold text-white">Authorized Admin Google Accounts</h2>
        </div>
        <p className="text-xs text-slate-400">
          When any Google account with an email matching this list signs in, they are immediately granted full Administrator access.
        </p>

        {/* Add Email Form */}
        <form onSubmit={handleAddEmail} className="flex gap-2">
          <div className="relative flex-1">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="e.g. administrator@gmail.com"
              className="w-full h-10 rounded-xl bg-slate-900/80 pl-10 pr-4 text-xs text-white border border-slate-800 focus:border-indigo-500 focus:outline-none transition-all placeholder:text-slate-500"
            />
          </div>
          <button
            type="submit"
            disabled={isSaving || !newEmail}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition-all cursor-pointer disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            <span>Add Admin</span>
          </button>
        </form>

        {/* Current List */}
        <div className="divide-y divide-slate-800/60 rounded-2xl bg-slate-950/60 border border-slate-800/60 overflow-hidden">
          {adminEmails.map((email) => (
            <div key={email} className="flex items-center justify-between p-3.5 text-xs">
              <div className="flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <span className="font-mono text-white">{email}</span>
              </div>
              <button
                type="button"
                onClick={() => handleRemoveEmail(email)}
                disabled={adminEmails.length <= 1 || isSaving}
                title="Remove admin email"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Security Architecture Summary */}
      <div className="rounded-3xl border border-slate-800/80 bg-[#0d121f]/90 p-6 shadow-2xl backdrop-blur-xl space-y-3 text-xs text-slate-300">
        <div className="flex items-center gap-2 text-white font-bold">
          <Lock className="h-4 w-4 text-indigo-400" />
          <span>Multi-Tenant Security Model</span>
        </div>
        <ul className="space-y-2 text-slate-400 list-disc list-inside">
          <li><strong>Google-Only Auth:</strong> Username and password bypass vectors are disabled.</li>
          <li><strong>Data Isolation:</strong> Video records, playlists, and stream configs are strictly indexed by Google UID.</li>
          <li><strong>Non-blocking Streaming:</strong> User streams run in independent FFmpeg server processes that persist across browser tabs and sessions.</li>
        </ul>
      </div>
    </div>
  );
};
