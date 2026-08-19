import React from 'react';
import {
  LayoutDashboard,
  Users,
  Radio,
  HardDrive,
  Sliders,
  Cpu,
  Terminal,
  ShieldCheck,
  ArrowLeft,
  LogOut,
  Tv,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';

export type AdminTab =
  | 'overview'
  | 'users'
  | 'streams'
  | 'storage'
  | 'settings'
  | 'system'
  | 'logs'
  | 'security';

interface AdminSidebarProps {
  currentTab: AdminTab;
  onSelectTab: (tab: AdminTab) => void;
  onExitAdmin: () => void;
  onAdminLogout: () => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  currentTab,
  onSelectTab,
  onExitAdmin,
  onAdminLogout,
  isOpenMobile,
  onCloseMobile,
}) => {
  const { user } = useAuth();

  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'users', label: 'User Accounts', icon: Users },
    { id: 'streams', label: 'Live Streams', icon: Radio },
    { id: 'storage', label: 'Server Storage', icon: HardDrive },
    { id: 'settings', label: 'System Settings', icon: Sliders },
    { id: 'system', label: 'VPS Diagnostics', icon: Cpu },
    { id: 'logs', label: 'Server Logs', icon: Terminal },
    { id: 'security', label: 'Security & Access', icon: ShieldCheck },
  ];

  return (
    <>
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex w-72 flex-col border-r border-indigo-500/20 bg-[#090d16] transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Admin Header */}
        <div className="flex h-18 items-center justify-between border-b border-slate-800/80 px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 shadow-lg shadow-indigo-500/20 ring-1 ring-white/10">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 font-bold tracking-tight text-white">
                <span className="text-base">StreamLoop</span>
                <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-500/30">
                  ADMIN
                </span>
              </div>
              <p className="text-xs text-slate-400">System Management</p>
            </div>
          </div>

          <button
            onClick={onCloseMobile}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Switch back to User Panel Button */}
        <div className="p-4">
          <button
            onClick={onExitAdmin}
            className="group flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600/15 p-3 text-xs font-bold text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/25 hover:text-white transition-all cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            <span>Return to User Panel</span>
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 space-y-1.5 overflow-y-auto px-4 py-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id as AdminTab);
                  if (isOpenMobile) onCloseMobile();
                }}
                className={`group flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600/20 text-indigo-300 shadow-sm ring-1 ring-indigo-500/30'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                }`}
              >
                <Icon
                  className={`h-4 w-4 transition-colors ${
                    isActive ? 'text-indigo-400' : 'text-slate-400 group-hover:text-slate-200'
                  }`}
                />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Admin User Footer */}
        <div className="border-t border-slate-800/80 p-4">
          <div className="flex items-center justify-between rounded-xl bg-slate-900/60 p-3 border border-slate-800/60">
            <div className="flex items-center gap-3 overflow-hidden">
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  referrerPolicy="no-referrer"
                  className="h-8 w-8 rounded-lg object-cover ring-1 ring-amber-500/40"
                />
              ) : (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 font-bold text-amber-400 border border-amber-500/30">
                  {user?.name?.charAt(0).toUpperCase() || 'A'}
                </div>
              )}
              <div className="overflow-hidden">
                <p className="truncate text-xs font-semibold text-white">{user?.name || user?.email}</p>
                <p className="text-[10px] font-mono text-amber-400">ADMINISTRATOR</p>
              </div>
            </div>
            <button
              onClick={onAdminLogout}
              title="Admin Logout"
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-rose-400 cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
