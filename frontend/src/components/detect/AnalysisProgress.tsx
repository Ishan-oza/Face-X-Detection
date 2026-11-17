import { Check, Loader2 } from 'lucide-react';
import type { AnalyzeStage } from '../../services/api';
import { cx } from '../ui';

export type RunStage = AnalyzeStage | 'complete';

const ORDER: RunStage[] = ['uploading', 'processing', 'receiving', 'complete'];

interface Props {
  stage: RunStage;
  /** Real upload fraction (0–1) reported by the browser, when known. */
  uploaded?: number;
  /** Seconds since the upload finished and the server started working. */
  serverSeconds: number;
  modelLabel: string;
}

/**
 * Lists only stages the browser can actually observe: local validation,
 * bytes uploaded, waiting for the server, and receiving its response.
 */
export function AnalysisProgress({ stage, uploaded, serverSeconds, modelLabel }: Props) {
  const at = ORDER.indexOf(stage);
  const pct = uploaded === undefined ? null : Math.round(uploaded * 100);

  const rows: Array<{ key: string; label: string; state: 'done' | 'active' | 'pending'; detail?: string; bar?: number | null }> = [
    { key: 'checked', label: 'Image checked in your browser', state: 'done' },
    {
      key: 'uploading',
      label: 'Uploading',
      state: at > 0 ? 'done' : 'active',
      detail: at > 0 ? 'Sent' : pct === null ? 'Sending…' : `${pct}%`,
      bar: at === 0 ? pct ?? null : undefined,
    },
    {
      key: 'processing',
      label: `Analysing with ${modelLabel}`,
      state: at > 1 ? 'done' : at === 1 ? 'active' : 'pending',
      detail: at === 1 ? `${serverSeconds}s` : undefined,
    },
    {
      key: 'receiving',
      label: 'Receiving results',
      state: at > 2 ? 'done' : at === 2 ? 'active' : 'pending',
    },
  ];

  return (
    <div>
      <ol className="space-y-1" aria-label="Analysis progress">
        {rows.map((r) => (
          <li
            key={r.key}
            aria-current={r.state === 'active' ? 'step' : undefined}
            className={cx(
              'rounded-lg px-3 py-2.5 transition-colors duration-300',
              r.state === 'active' && 'bg-white/[0.035]',
            )}
          >
            <div className="flex items-center gap-3">
              <span
                className={cx(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all duration-500 ease-out-expo',
                  r.state === 'done' && 'border-signal bg-signal text-ink-950',
                  r.state === 'active' && 'border-signal/60 text-signal',
                  r.state === 'pending' && 'border-white/15',
                )}
              >
                {r.state === 'done' && <Check aria-hidden className="h-3 w-3 animate-scale-in" strokeWidth={3} />}
                {r.state === 'active' && <Loader2 aria-hidden className="h-3 w-3 animate-spin" />}
              </span>
              <span className={cx('min-w-0 flex-1 truncate text-sm', r.state === 'pending' ? 'text-mist' : 'text-bone')}>
                {r.label}
              </span>
              {r.detail && (
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-mist">{r.detail}</span>
              )}
            </div>
            {r.bar !== undefined && (
              <div className="ml-8 mt-2 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                {r.bar === null ? (
                  <div className="h-full w-2/5 animate-indeterminate rounded-full bg-signal" />
                ) : (
                  <div
                    className="h-full rounded-full bg-signal transition-[width] duration-200 ease-out"
                    style={{ width: `${r.bar}%` }}
                  />
                )}
              </div>
            )}
          </li>
        ))}
      </ol>
      {stage === 'processing' && serverSeconds >= 15 && (
        <p className="mt-3 animate-fade-up-fast px-3 text-xs text-mist">
          Still working. CPU inference or the first request after start-up can take longer.
        </p>
      )}
    </div>
  );
}
