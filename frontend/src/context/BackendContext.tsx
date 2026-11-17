import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { errorMessage, getHealth, getModels } from '../services/api';
import type { HealthResponse, ModelInfo } from '../services/apiTypes';

export type Connection = 'checking' | 'online' | 'offline';

interface BackendState {
  connection: Connection;
  health: HealthResponse | null;
  healthError: string | null;
  models: ModelInfo[] | null;
  modelsError: string | null;
  refresh: () => void;
}

const BackendContext = createContext<BackendState | null>(null);

/** Checks /api/health and /api/models once on load and on demand. */
export function BackendProvider({ children }: { children: ReactNode }) {
  const [connection, setConnection] = useState<Connection>('checking');
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [models, setModels] = useState<ModelInfo[] | null>(null);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const inflight = useRef<AbortController | null>(null);

  const refresh = useCallback(() => {
    inflight.current?.abort();
    const controller = new AbortController();
    inflight.current = controller;
    setConnection('checking');

    void Promise.allSettled([getHealth(controller.signal), getModels(controller.signal)]).then(([h, m]) => {
      if (controller.signal.aborted) return;

      if (h.status === 'fulfilled') {
        setHealth(h.value);
        setHealthError(null);
        setConnection('online');
      } else {
        setHealth(null);
        setHealthError(errorMessage(h.reason));
        setConnection('offline');
      }

      if (m.status === 'fulfilled') {
        setModels(m.value.models);
        setModelsError(null);
      } else {
        setModels(null);
        setModelsError(errorMessage(m.reason));
      }
    });
  }, []);

  useEffect(() => {
    refresh();
    return () => inflight.current?.abort();
  }, [refresh]);

  const value = useMemo(
    () => ({ connection, health, healthError, models, modelsError, refresh }),
    [connection, health, healthError, models, modelsError, refresh],
  );

  return <BackendContext.Provider value={value}>{children}</BackendContext.Provider>;
}

export function useBackend() {
  const ctx = useContext(BackendContext);
  if (!ctx) throw new Error('useBackend must be used inside <BackendProvider>');
  return ctx;
}
