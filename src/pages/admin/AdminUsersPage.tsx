import React, { useEffect, useState } from 'react';
import {
  Users,
  Search,
  Shield,
  User as UserIcon,
  CheckCircle,
  XCircle,
  Trash2,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Check,
} from 'lucide-react';
import { apiFetch } from '../../lib/api.ts';
import { User } from '../../types/index.ts';
import { useAuth } from '../../context/AuthContext.tsx';

export const AdminUsersPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const data = await apiFetch<{ users: User[] }>('/api/admin/users');
      setUsers(data.users);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to fetch users' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = async (targetUser: User, newRole: 'ADMIN' | 'USER') => {
    if (targetUser.role === newRole) return;
    setActionLoadingId(targetUser.id);
    setFeedback(null);
    try {
      const res = await apiFetch<{ message: string; user: User }>(`/api/admin/users/${targetUser.id}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role: newRole }),
      });
      setUsers((prev) => prev.map((u) => (u.id === targetUser.id ? res.user : u)));
      setFeedback({ type: 'success', message: `Updated ${targetUser.email} role to ${newRole}` });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to update role' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleStatusToggle = async (targetUser: User) => {
    const newStatus = targetUser.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    setActionLoadingId(targetUser.id);
    setFeedback(null);
    try {
      const res = await apiFetch<{ message: string; user: User }>(`/api/admin/users/${targetUser.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      setUsers((prev) => prev.map((u) => (u.id === targetUser.id ? res.user : u)));
      setFeedback({ type: 'success', message: `User ${targetUser.email} is now ${newStatus}` });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to update user status' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    setActionLoadingId(userToDelete.id);
    setFeedback(null);
    try {
      await apiFetch(`/api/admin/users/${userToDelete.id}`, { method: 'DELETE' });
      setUsers((prev) => prev.filter((u) => u.id !== userToDelete.id));
      setFeedback({ type: 'success', message: `User ${userToDelete.email} and their data were deleted.` });
      setUserToDelete(null);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to delete user' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.googleId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-white">User Accounts</h1>
            <span className="rounded-md bg-indigo-500/10 px-2 py-0.5 text-xs font-semibold text-indigo-400 border border-indigo-500/20">
              {users.length} Registered
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Google-authenticated accounts with isolated videos, playlists, and streams.
          </p>
        </div>

        <button
          onClick={fetchUsers}
          disabled={isLoading}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-300 border border-slate-800 hover:bg-slate-800 hover:text-white transition-all cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
          <span>Refresh Users</span>
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

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search users by name, email, or Google UID..."
          className="w-full h-11 rounded-2xl bg-slate-900/60 pl-11 pr-4 text-xs text-white border border-slate-800 focus:border-indigo-500 focus:outline-none transition-all placeholder:text-slate-500"
        />
      </div>

      {/* Users Table */}
      <div className="overflow-hidden rounded-3xl border border-slate-800/80 bg-[#0d121f]/90 shadow-2xl backdrop-blur-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="border-b border-slate-800/80 bg-slate-950/60 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Google ID</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Account Status</th>
                <th className="px-6 py-4">Last Login</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    No users matching search criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isCurrent = u.id === currentUser?.id;
                  const isBusy = actionLoadingId === u.id;

                  return (
                    <tr key={u.id} className="hover:bg-slate-900/40 transition-colors">
                      {/* Avatar & Name */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {u.avatar ? (
                            <img
                              src={u.avatar}
                              alt={u.name}
                              referrerPolicy="no-referrer"
                              className="h-9 w-9 rounded-xl object-cover ring-1 ring-slate-700"
                            />
                          ) : (
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600/20 text-indigo-400 font-bold text-xs ring-1 ring-indigo-500/30">
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 font-semibold text-white truncate">
                              <span>{u.name}</span>
                              {isCurrent && (
                                <span className="rounded bg-indigo-500/20 px-1.5 py-0.2 text-[10px] text-indigo-300 border border-indigo-500/30">
                                  You
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 truncate">{u.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Google ID */}
                      <td className="px-6 py-4 font-mono text-[11px] text-slate-400 max-w-[140px] truncate">
                        {u.googleId}
                      </td>

                      {/* Role Dropdown */}
                      <td className="px-6 py-4">
                        <select
                          value={u.role}
                          disabled={isBusy || (isCurrent && u.role === 'ADMIN')}
                          onChange={(e) => handleRoleChange(u, e.target.value as 'ADMIN' | 'USER')}
                          className={`rounded-lg px-2.5 py-1 text-xs font-semibold border transition-all cursor-pointer ${
                            u.role === 'ADMIN'
                              ? 'bg-indigo-950/60 text-indigo-300 border-indigo-800/60'
                              : 'bg-slate-900 text-slate-300 border-slate-800'
                          }`}
                        >
                          <option value="USER">USER</option>
                          <option value="ADMIN">ADMIN</option>
                        </select>
                      </td>

                      {/* Status Toggle */}
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleStatusToggle(u)}
                          disabled={isBusy || isCurrent}
                          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold border transition-all cursor-pointer ${
                            u.status === 'ACTIVE'
                              ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40 hover:bg-emerald-950/60'
                              : 'bg-rose-950/40 text-rose-400 border-rose-800/40 hover:bg-rose-950/60'
                          } disabled:opacity-60 disabled:cursor-not-allowed`}
                        >
                          {u.status === 'ACTIVE' ? (
                            <>
                              <CheckCircle className="h-3.5 w-3.5" />
                              <span>ACTIVE</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="h-3.5 w-3.5" />
                              <span>DISABLED</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Last Login */}
                      <td className="px-6 py-4 text-[11px] text-slate-400 font-mono">
                        {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : 'N/A'}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => setUserToDelete(u)}
                          disabled={isBusy || isCurrent}
                          title={isCurrent ? 'Cannot delete your own account' : 'Delete user'}
                          className="rounded-lg p-2 text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto custom-scrollbar rounded-3xl border border-slate-800 bg-[#0d121f] p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 border border-rose-500/20">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Delete User Account</h3>
                <p className="text-xs text-slate-400">{userToDelete.email}</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to permanently delete this user account? All of their uploaded videos, playlists, and active stream sessions will be terminated and deleted.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800 hover:text-white transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                disabled={actionLoadingId === userToDelete.id}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-500 shadow-lg shadow-rose-600/30 transition-all cursor-pointer disabled:opacity-50"
              >
                {actionLoadingId === userToDelete.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
