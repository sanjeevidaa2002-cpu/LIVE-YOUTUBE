import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { StreamState, StreamConfig, LogEntry } from '../types/index.ts';
import { apiFetch } from '../lib/api.ts';
import { useAuth } from './AuthContext.tsx';

interface StreamContextType {
  streamState: StreamState | null;
  logs: LogEntry[];
  isLoading: boolean;
  isActionLoading: boolean;
  actionError: string | null;
  startStream: (config: StreamConfig) => Promise<boolean>;
  stopStream: () => Promise<boolean>;
  restartStream: () => Promise<boolean>;
  clearLogs: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  refreshLogs: () => Promise<void>;
}

const StreamContext = createContext<StreamContextType | undefined>(undefined);

export const StreamProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, token } = useAuth();
  const [streamState, setStreamState] = useState<StreamState | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const logBufferRef = useRef<LogEntry[]>([]);
  const logFlushTimeoutRef = useRef<any>(null);

  const flushLogBuffer = useCallback(() => {
    if (logBufferRef.current.length === 0) return;
    const batch = logBufferRef.current;
    logBufferRef.current = [];
    setLogs((prev) => {
      const next = [...prev, ...batch];
      return next.length > 500 ? next.slice(-500) : next;
    });
  }, []);

  const queueLogEntry = useCallback((newLog: LogEntry) => {
    logBufferRef.current.push(newLog);
    if (!logFlushTimeoutRef.current) {
      logFlushTimeoutRef.current = setTimeout(() => {
        logFlushTimeoutRef.current = null;
        flushLogBuffer();
      }, 250);
    }
  }, [flushLogBuffer]);

  const refreshStatus = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const data = await apiFetch<StreamState>('/api/stream/status');
      if (data && typeof data === 'object') {
        setStreamState(data);
      }
    } catch (err) {
      console.warn('Failed to fetch stream status:', err);
    }
  }, [isAuthenticated]);

  const refreshLogs = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const data = await apiFetch<{ logs: LogEntry[] }>('/api/stream/logs?limit=100');
      if (data && Array.isArray(data.logs)) {
        setLogs(data.logs);
      }
    } catch (err) {
      console.warn('Failed to fetch logs:', err);
    }
  }, [isAuthenticated]);

  // Connect SSE or setup polling
  useEffect(() => {
    let isMounted = true;

    if (!isAuthenticated || !token) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      return;
    }

    refreshStatus().finally(() => {
      if (isMounted) setIsLoading(false);
    });
    refreshLogs();

    try {
      const sseUrl = `/api/stream/events?token=${encodeURIComponent(token)}`;
      const es = new EventSource(sseUrl);
      eventSourceRef.current = es;

      es.addEventListener('status', (e) => {
        if (!isMounted) return;
        try {
          const parsed = JSON.parse(e.data);
          if (parsed && typeof parsed === 'object') {
            setStreamState(parsed);
          }
        } catch {}
      });

      es.addEventListener('log', (e) => {
        if (!isMounted) return;
        try {
          const newLog = JSON.parse(e.data);
          if (newLog && typeof newLog === 'object') {
            queueLogEntry(newLog);
          }
        } catch {}
      });

      es.addEventListener('logs', (e) => {
        if (!isMounted) return;
        try {
          const initialLogs = JSON.parse(e.data);
          if (Array.isArray(initialLogs)) {
            setLogs(initialLogs);
          }
        } catch {}
      });

      es.onerror = () => {
        // Handled silently; browser will retry or polling will cover it
      };
    } catch (err) {
      console.warn('[StreamContext] SSE initialization skipped:', err);
    }

    // Secondary polling interval (every 4 seconds) for robust state sync
    const pollInterval = setInterval(() => {
      if (isMounted) {
        refreshStatus();
      }
    }, 4000);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
      if (logFlushTimeoutRef.current) {
        clearTimeout(logFlushTimeoutRef.current);
        logFlushTimeoutRef.current = null;
      }
      flushLogBuffer();
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [isAuthenticated, token, refreshStatus, refreshLogs, queueLogEntry, flushLogBuffer]);

  const startStream = async (config: StreamConfig): Promise<boolean> => {
    setIsActionLoading(true);
    setActionError(null);
    try {
      const res = await apiFetch<{ message: string; status: StreamState }>('/api/stream/start', {
        method: 'POST',
        body: JSON.stringify(config),
      });
      if (res.status) setStreamState(res.status);
      return true;
    } catch (err: any) {
      setActionError(err.message || 'Failed to start stream');
      return false;
    } finally {
      setIsActionLoading(false);
    }
  };

  const stopStream = async (): Promise<boolean> => {
    setIsActionLoading(true);
    setActionError(null);
    try {
      const res = await apiFetch<{ message: string; status: StreamState }>('/api/stream/stop', {
        method: 'POST',
      });
      if (res.status) setStreamState(res.status);
      return true;
    } catch (err: any) {
      setActionError(err.message || 'Failed to stop stream');
      return false;
    } finally {
      setIsActionLoading(false);
    }
  };

  const restartStream = async (): Promise<boolean> => {
    setIsActionLoading(true);
    setActionError(null);
    try {
      const res = await apiFetch<{ message: string; status: StreamState }>('/api/stream/restart', {
        method: 'POST',
      });
      if (res.status) setStreamState(res.status);
      return true;
    } catch (err: any) {
      setActionError(err.message || 'Failed to restart stream');
      return false;
    } finally {
      setIsActionLoading(false);
    }
  };

  const clearLogs = async () => {
    try {
      await apiFetch('/api/stream/logs', { method: 'DELETE' });
      setLogs([]);
    } catch (err) {
      console.warn('Failed to clear logs:', err);
    }
  };

  return (
    <StreamContext.Provider
      value={{
        streamState,
        logs,
        isLoading,
        isActionLoading,
        actionError,
        startStream,
        stopStream,
        restartStream,
        clearLogs,
        refreshStatus,
        refreshLogs,
      }}
    >
      {children}
    </StreamContext.Provider>
  );
};

export const useStream = () => {
  const context = useContext(StreamContext);
  if (!context) {
    throw new Error('useStream must be used within a StreamProvider');
  }
  return context;
};
