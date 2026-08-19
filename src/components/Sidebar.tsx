import React from 'react';
import {
  LayoutDashboard,
  Film,
  ListOrdered,
  Radio,
  Activity,
  History,
  LogOut,
  Repeat,
  Tv,
  Shield,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useStream } from '../context/StreamContext.tsx';

export type NavTab =
  | 'dashboard'
  | 'library'
  | 'playlist'
  | 'start-stream'
  | 'active-stream'
  | 'history';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  isOpenMobile,
  onCloseMobile,
}) => {
  const { user, logout } = useAuth();
  const { streamState } = useStream();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'library', label: 'Video Library', icon: Film },
    { id: 'playlist', label: 'Video Playlist', icon: ListOrdered },
    { id: 'start-stream', label: 'Start Stream', icon: Radio, highlight: true },
    { id: 'active-stream', label: 'Active Stream', icon: Activity, badge: streamState?.status === 'LIVE' ? 'LIVE' : undefined },
    { id: 'history', label: 'Stream History', icon: History },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex w-72 flex-col border-r border-slate-800/80 bg-[#0c111d] transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="flex h-18 items-center justify-between border-b border-slate-800/80 px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 shadow-lg shadow-indigo-500/20 ring-1 ring-white/10">
              <Tv className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 font-bold tracking-tight text-white">
                <span className="text-base">StreamLoop</span>
                <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-400 border border-indigo-500/30">
                  24×7
                </span>
              </div>
              <p className="text-xs text-slate-400">YouTube RTMP Engine</p>
            </div>
          </div>

          <button
            onClick={onCloseMobile}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Live Stream Status Widget in Sidebar */}
        <div className="p-4">
          <div
            onClick={() => {
              onSelectTab('active-stream');
              if (isOpenMobile) onCloseMobile();
            }}
            className={`cursor-pointer rounded-2xl border p-3.5 transition-all ${
              streamState?.status === 'LIVE'
                ? 'border-emerald-500/30 bg-emerald-950/20 hover:bg-emerald-950/30'
                : streamState?.status === 'RECONNECTING'
                ? 'border-indigo-500/30 bg-indigo-950/20 hover:bg-indigo-950/30'
                : 'border-slate-800/80 bg-slate-900/40 hover:bg-slate-900/60'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                Your Stream Status
              </span>
              <span
                className={`flex h-2 w-2 rounded-full ${
                  streamState?.status === 'LIVE'
                    ? 'bg-emerald-400 animate-ping'
                    : streamState?.status === 'RECONNECTING'
                    ? 'bg-indigo-400 animate-spin'
                    : 'bg-slate-600'
                }`}
              />
            </div>
            <div className="flex items-center justify-between">
              <span
                className={`text-sm font-semibold ${
                  streamState?.status === 'LIVE'
                    ? 'text-emerald-400'
                    : streamState?.status === 'RECONNECTING'
                    ? 'text-indigo-400'
                    : 'text-slate-300'
                }`}
              >
                {streamState?.status || 'STOPPED'}
              </span>
              {streamState?.status === 'LIVE' && (
                <span className="font-mono text-xs font-medium text-emerald-300">
                  {streamState.uptimeFormatted}
                </span>
              )}
            </div>

            {streamState?.status === 'LIVE' && (
              <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400">
                <Repeat className="h-3 w-3 text-indigo-400" />
                <span>Loop #{streamState.currentLoop || 1}</span>
                <span className="text-slate-600">•</span>
                <span className="truncate max-w-[120px]">
                  {streamState.currentVideo?.originalName || streamState.video?.originalName || 'Stream Active'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Navigation items */}
        <nav className="flex-1 space-y-1.5 overflow-y-auto px-4 py-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id as NavTab);
                  if (isOpenMobile) onCloseMobile();
                }}
                className={`group flex w-full items-center justify-between rounded-xl px-3.5 py-3 text-sm font-medium transition-all cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600/15 text-indigo-300 shadow-sm ring-1 ring-indigo-500/30'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`h-4.5 w-4.5 transition-colors ${
                      isActive ? 'text-indigo-400' : 'text-slate-400 group-hover:text-slate-200'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>

                {item.badge && (
                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/40 animate-pulse">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User Account Footer */}
        <div className="border-t border-slate-800/80 p-4">
          <div className="flex items-center justify-between rounded-xl bg-slate-900/60 p-3 border border-slate-800/60">
            <div className="flex items-center gap-3 overflow-hidden">
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  referrerPolicy="no-referrer"
                  className="h-9 w-9 shrink-0 rounded-xl object-cover ring-1 ring-slate-700"
                />
              ) : (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-950 font-bold text-indigo-400 border border-indigo-800/40">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </div>
              )}
              <div className="overflow-hidden">
                <p className="truncate text-xs font-semibold text-white">{user?.name || user?.email}</p>
                <p className="truncate text-[11px] text-slate-400">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={logout}
              title="Logout"
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-rose-400 cursor-pointer"
            >
              <LogOut className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
