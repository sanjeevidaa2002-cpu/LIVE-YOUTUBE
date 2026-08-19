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

  const refreshStatus = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const data = await apiFetch<StreamState>('/api/stream/status');
      setStreamState(data);
    } catch (err) {
      console.warn('Failed to fetch stream status:', err);
    }
  }, [isAuthenticated]);

  const refreshLogs = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const data = await apiFetch<{ logs: LogEntry[] }>('/api/stream/logs?limit=100');
      setLogs(data.logs || []);
    } catch (err) {
      console.warn('Failed to fetch logs:', err);
    }
  }, [isAuthenticated]);

  // Connect SSE or setup polling
  useEffect(() => {
    if (!isAuthenticated || !token) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      return;
    }

    refreshStatus().finally(() => setIsLoading(false));
    refreshLogs();

    let sseSupported = true;
    try {
      const sseUrl = `/api/stream/events?token=${encodeURIComponent(token)}`;
      const es = new EventSource(sseUrl);
      eventSourceRef.current = es;

      es.addEventListener('status', (e) => {
        try {
          const parsed = JSON.parse(e.data);
          setStreamState(parsed);
        } catch {}
      });

      es.addEventListener('log', (e) => {
        try {
          const newLog = JSON.parse(e.data);
          setLogs((prev) => {
            const next = [...prev, newLog];
            return next.length > 500 ? next.slice(-500) : next;
          });
        } catch {}
      });

      es.addEventListener('logs', (e) => {
        try {
          const initialLogs = JSON.parse(e.data);
          setLogs(initialLogs);
        } catch {}
      });

      es.onerror = () => {
        sseSupported = false;
      };
    } catch {
      sseSupported = false;
    }

    // Secondary polling interval (every 3 seconds) for robust state sync
    const pollInterval = setInterval(() => {
      refreshStatus();
    }, 3000);

    return () => {
      clearInterval(pollInterval);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [isAuthenticated, token, refreshStatus, refreshLogs]);

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
