import React from 'react';
import { StreamStatus } from '../types/index.ts';
import { Radio, AlertCircle, RefreshCw, Square, Play, Pause } from 'lucide-react';

interface LiveBadgeProps {
  status: StreamStatus | undefined;
  size?: 'sm' | 'md' | 'lg';
  showPulse?: boolean;
}

export const LiveBadge: React.FC<LiveBadgeProps> = ({ status = 'STOPPED', size = 'md', showPulse = true }) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'LIVE':
        return {
          bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
          dot: 'bg-emerald-500',
          label: 'LIVE (24×7)',
          icon: Radio,
          pulseClass: 'animate-ping',
        };
      case 'STARTING':
        return {
          bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
          dot: 'bg-amber-500',
          label: 'STARTING',
          icon: Play,
          pulseClass: 'animate-spin',
        };
      case 'STOPPING':
        return {
          bg: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
          dot: 'bg-orange-500',
          label: 'STOPPING',
          icon: Pause,
          pulseClass: 'animate-pulse',
        };
      case 'RECONNECTING':
        return {
          bg: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
          dot: 'bg-indigo-500',
          label: 'RECONNECTING',
          icon: RefreshCw,
          pulseClass: 'animate-spin',
        };
      case 'ERROR':
        return {
          bg: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
          dot: 'bg-rose-500',
          label: 'STREAM ERROR',
          icon: AlertCircle,
          pulseClass: 'animate-bounce',
        };
      case 'STOPPED':
      case 'IDLE':
      default:
        return {
          bg: 'bg-slate-800/60 text-slate-400 border-slate-700/50',
          dot: 'bg-slate-500',
          label: 'STOPPED',
          icon: Square,
          pulseClass: '',
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs font-semibold gap-1.5',
    md: 'px-3 py-1 text-xs font-semibold tracking-wide gap-2',
    lg: 'px-4 py-1.5 text-sm font-bold tracking-wider gap-2.5',
  };

  const dotSizes = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-2.5 h-2.5',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border backdrop-blur-md uppercase shadow-sm ${config.bg} ${sizeClasses[size]}`}
    >
      <span className="relative flex items-center justify-center">
        {showPulse && (status === 'LIVE' || status === 'RECONNECTING' || status === 'STARTING') && (
          <span
            className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${config.dot} ${config.pulseClass}`}
          />
        )}
        <span className={`relative inline-flex rounded-full ${config.dot} ${dotSizes[size]}`} />
      </span>
      <Icon className={size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
      <span>{config.label}</span>
    </span>
  );
};
