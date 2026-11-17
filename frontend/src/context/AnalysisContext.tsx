import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AnalyzeResult } from '../services/api';
import type { ValidatedImage } from '../lib/imageValidation';

export interface CompletedAnalysis extends AnalyzeResult {
  image: ValidatedImage;
  /** "standard" runs the server's default pipeline; "advanced" ran a user-chosen model. */
  mode: 'standard' | 'advanced';
  modelId: string | null;
  modelName: string | null;
  completedAt: Date;
  useGemini?: boolean;
  /**
   * Measured in the browser around the request. Only the total is recorded: browsers can
   * report "upload complete" late for small files, so an upload/response split would mislead.
   */
  timings?: {
    /** From sending the request to receiving the full response. */
    totalMs: number;
  };
}

interface AnalysisState {
  /** The image currently staged on the Detect page. */
  selection: ValidatedImage | null;
  /** The most recent backend result. Kept in memory only — nothing is stored or uploaded elsewhere. */
  analysis: CompletedAnalysis | null;
  select: (image: ValidatedImage | null) => void;
  complete: (analysis: CompletedAnalysis) => void;
  reset: () => void;
}

const AnalysisContext = createContext<AnalysisState | null>(null);

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<ValidatedImage | null>(null);
  const [analysis, setAnalysis] = useState<CompletedAnalysis | null>(null);

  // Revoke object URLs that are no longer referenced by either slot.
  const urls = useRef(new Set<string>());
  useEffect(() => {
    const live = new Set([selection?.previewUrl, analysis?.image.previewUrl].filter(Boolean) as string[]);
    for (const url of urls.current) {
      if (!live.has(url)) {
        URL.revokeObjectURL(url);
        urls.current.delete(url);
      }
    }
    live.forEach((u) => urls.current.add(u));
  }, [selection, analysis]);

  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const select = useCallback((image: ValidatedImage | null) => setSelection(image), []);
  const complete = useCallback((a: CompletedAnalysis) => setAnalysis(a), []);
  const reset = useCallback(() => {
    setSelection(null);
    setAnalysis(null);
  }, []);

  const value = useMemo(
    () => ({ selection, analysis, select, complete, reset }),
    [selection, analysis, select, complete, reset],
  );

  return <AnalysisContext.Provider value={value}>{children}</AnalysisContext.Provider>;
}

export function useAnalysis() {
  const ctx = useContext(AnalysisContext);
  if (!ctx) throw new Error('useAnalysis must be used inside <AnalysisProvider>');
  return ctx;
}
