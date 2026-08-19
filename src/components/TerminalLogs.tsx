import React, { useState, useRef, useEffect } from 'react';
import { Terminal, Copy, Trash2, Search, ArrowDown, Check } from 'lucide-react';
import { LogEntry } from '../types/index.ts';

interface TerminalLogsProps {
  logs: LogEntry[];
  onClearLogs?: () => void;
  maxHeight?: string;
}

export const TerminalLogs: React.FC<TerminalLogsProps> = ({
  logs,
  onClearLogs,
  maxHeight = 'max-h-96',
}) => {
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const filteredLogs = logs.filter((log) => {
    if (filterType !== 'all' && log.type !== filterType) {
      if (filterType === 'error' && log.type !== 'error' && log.type !== 'stderr') return false;
      if (filterType === 'system' && log.type !== 'system' && log.type !== 'success') return false;
      if (filterType === 'stdout' && log.type !== 'stdout') return false;
    }
    if (searchQuery.trim()) {
      return log.message.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  });

  const handleCopy = () => {
    const text = filteredLogs.map((l) => `[${l.timestamp}] [${l.type.toUpperCase()}] ${l.message}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getLogTypeColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'error':
        return 'text-rose-400 font-semibold';
      case 'stderr':
        return 'text-amber-300/90';
      case 'success':
        return 'text-emerald-400 font-semibold';
      case 'system':
        return 'text-indigo-300 font-semibold';
      case 'stdout':
      default:
        return 'text-slate-300';
    }
  };

  return (
    <div className="flex flex-col rounded-2xl border border-slate-800 bg-[#07090e] shadow-2xl overflow-hidden">
      {/* Terminal Titlebar */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-800/80 bg-slate-900/70 px-4 py-2.5 gap-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-rose-500/80" />
            <span className="h-3 w-3 rounded-full bg-amber-500/80" />
            <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
            <Terminal className="h-3.5 w-3.5 text-indigo-400" />
            <span>ffmpeg.stdout.stderr.log</span>
            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400 font-sans">
              {filteredLogs.length} events
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Filter logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-7 w-36 rounded-lg bg-slate-950 pl-8 pr-2.5 text-xs text-slate-200 placeholder-slate-400 border border-slate-800 focus:border-indigo-500 focus:outline-none transition-all sm:w-48"
            />
          </div>

          {/* Type filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="h-7 rounded-lg bg-slate-950 px-2 text-xs text-slate-300 border border-slate-800 focus:border-indigo-500 focus:outline-none"
          >
            <option value="all">All Logs</option>
            <option value="system">System</option>
            <option value="error">Errors</option>
            <option value="stdout">Output</option>
          </select>

          {/* Autoscroll toggle */}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            title={autoScroll ? 'Disable Auto-scroll' : 'Enable Auto-scroll'}
            className={`flex h-7 items-center gap-1 rounded-lg px-2 text-xs transition-colors border ${
              autoScroll
                ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/30'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            <ArrowDown className="h-3 w-3" />
            <span className="hidden sm:inline">Auto</span>
          </button>

          {/* Copy button */}
          <button
            onClick={handleCopy}
            title="Copy Logs"
            className="flex h-7 items-center gap-1 rounded-lg bg-slate-950 px-2.5 text-xs text-slate-300 border border-slate-800 hover:bg-slate-800 hover:text-white transition-colors"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
          </button>

          {/* Clear button */}
          {onClearLogs && (
            <button
              onClick={onClearLogs}
              title="Clear Logs"
              className="flex h-7 items-center gap-1 rounded-lg bg-slate-950 px-2.5 text-xs text-slate-400 border border-slate-800 hover:bg-rose-950/30 hover:text-rose-400 transition-colors"
            >
              <Trash2 className="h-3 w-3" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Terminal Content */}
      <div
        ref={scrollRef}
        className={`flex-1 overflow-y-auto custom-scrollbar p-4 font-mono text-xs leading-relaxed select-text ${maxHeight}`}
      >
        {filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <Terminal className="h-8 w-8 mb-2 opacity-30" />
            <p>No log messages matching criteria.</p>
            <p className="text-[11px] text-slate-400">Logs will stream here automatically when FFmpeg runs.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {filteredLogs.map((log) => {
              const timeFormatted = new Date(log.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              });
              return (
                <div key={log.id} className="flex items-start gap-2 hover:bg-white/[0.02] py-0.5 px-1 rounded">
                  <span className="text-slate-400 shrink-0 select-none">[{timeFormatted}]</span>
                  <span className={`shrink-0 uppercase text-[10px] px-1 py-0.2 rounded border ${
                    log.type === 'error' ? 'bg-rose-950/50 text-rose-400 border-rose-800/40' :
                    log.type === 'stderr' ? 'bg-amber-950/40 text-amber-300 border-amber-800/30' :
                    log.type === 'system' ? 'bg-indigo-950/50 text-indigo-300 border-indigo-800/40' :
                    log.type === 'success' ? 'bg-emerald-950/50 text-emerald-300 border-emerald-800/40' :
                    'bg-slate-800 text-slate-400 border-slate-700'
                  }`}>
                    {log.type}
                  </span>
                  <span className={`break-all ${getLogTypeColor(log.type)}`}>
                    {log.message}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
