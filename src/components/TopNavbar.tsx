import React, { useState, useEffect } from 'react';
import { Menu, Radio, Square, Play, RefreshCw, Clock, Shield, User } from 'lucide-react';
import { useStream } from '../context/StreamContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { LiveBadge } from './LiveBadge.tsx';
import { NavTab } from './Sidebar.tsx';

interface TopNavbarProps {
  currentTab: NavTab;
  onOpenMobile: () => void;
  onNavigate: (tab: NavTab) => void;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({
  currentTab,
  onOpenMobile,
  onNavigate,
}) => {
  const { user } = useAuth();
  const { streamState, stopStream, isActionLoading } = useStream();
  const [timeStr, setTimeStr] = useState<string>('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const getTabTitle = (tab: NavTab) => {
    switch (tab) {
      case 'dashboard': return 'Dashboard Overview';
      case 'library': return 'Video Library';
      case 'playlist': return 'Video Playlist Manager';
      case 'start-stream': return '24×7 YouTube Stream Setup';
      case 'active-stream': return 'Active Stream Monitor';
      case 'history': return 'Broadcast Sessions History';
      default: return 'Dashboard';
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-18 w-full items-center justify-between border-b border-slate-800/80 bg-[#080B12]/90 px-4 backdrop-blur-md sm:px-6 lg:px-8">
      <div className="flex items-center gap-3 sm:gap-4">
        <button
          onClick={onOpenMobile}
          className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden cursor-pointer"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div>
          <h1 className="text-base font-bold tracking-tight text-white sm:text-lg">
            {getTabTitle(currentTab)}
          </h1>
          <p className="hidden text-xs text-slate-400 sm:block">
            24×7 Background YouTube Stream Engine
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        {/* Clock */}
        <div className="hidden items-center gap-2 rounded-xl bg-slate-900/60 px-3 py-1.5 text-xs text-slate-400 border border-slate-800/60 md:flex">
          <Clock className="h-3.5 w-3.5 text-indigo-400" />
          <span className="font-mono">{timeStr}</span>
        </div>

        {/* Live Status Badge */}
        <div onClick={() => onNavigate('active-stream')} className="cursor-pointer">
          <LiveBadge status={streamState?.status} size="md" />
        </div>

        {/* Quick Action Button */}
        {streamState?.status === 'LIVE' ? (
          <button
            onClick={() => stopStream()}
            disabled={isActionLoading}
            className="flex items-center gap-2 rounded-xl bg-rose-500/10 px-3.5 py-2 text-xs font-semibold text-rose-400 border border-rose-500/30 transition-all hover:bg-rose-500/20 active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            {isActionLoading ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Square className="h-3.5 w-3.5 fill-current" />
            )}
            <span className="hidden sm:inline">STOP STREAM</span>
          </button>
        ) : (
          <button
            onClick={() => onNavigate('start-stream')}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/25 transition-all hover:bg-indigo-500 active:scale-95 cursor-pointer"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            <span className="hidden sm:inline">START STREAM</span>
          </button>
        )}

        {/* User Google Avatar */}
        {user && (
          <div className="flex items-center gap-2 pl-2 border-l border-slate-800/80">
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                referrerPolicy="no-referrer"
                className="h-8 w-8 rounded-xl object-cover ring-1 ring-slate-700"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-950 text-indigo-400 font-bold text-xs ring-1 ring-indigo-800/40">
                {user.name?.charAt(0).toUpperCase() || 'U'}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
