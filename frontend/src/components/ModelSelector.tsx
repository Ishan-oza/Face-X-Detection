import { Check } from 'lucide-react';
import type { ModelInfo } from '../services/apiTypes';
import { Badge, cx, type Tone } from './ui';

export const isReady = (m: ModelInfo) => m.status === 'ready';

export function modelStatusBadge(status: string): { label: string; tone: Tone } {
  switch (status) {
    case 'ready':
      return { label: 'Ready', tone: 'real' };
    case 'loading':
      return { label: 'Loading', tone: 'caution' };
    case 'unavailable':
      return { label: 'Unavailable', tone: 'neutral' };
    case 'error':
      return { label: 'Error', tone: 'fake' };
    default:
      return { label: status, tone: 'neutral' };
  }
}

interface ModelSelectorProps {
  models: ModelInfo[];
  value: string | null;
  onChange: (id: string) => void;
  disabled?: boolean;
}

/** Radio group built solely from the backend's /api/models response. */
export function ModelSelector({ models, value, onChange, disabled }: ModelSelectorProps) {
  return (
    <fieldset disabled={disabled} className="space-y-2.5">
      <legend className="sr-only">Detection model</legend>
      {models.map((m) => {
        const ready = isReady(m);
        const selected = value === m.id;
        const badge = modelStatusBadge(m.status);
        return (
          <label
            key={m.id}
            className={cx(
              'relative flex gap-3.5 rounded-xl border p-4 transition-[border-color,background-color,transform] duration-200',
              ready ? 'cursor-pointer active:scale-[0.99]' : 'cursor-not-allowed',
              selected ? 'border-signal/60 bg-signal/[0.05]' : 'border-white/[0.08] bg-ink-850',
              ready && !selected && 'hover:border-white/20',
              !ready && 'opacity-70',
            )}
          >
            <input
              type="radio"
              name="model"
              value={m.id}
              checked={selected}
              disabled={!ready}
              onChange={() => onChange(m.id)}
              className="peer sr-only"
            />
            <span
              aria-hidden
              className={cx(
                'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition peer-focus-visible:ring-2 peer-focus-visible:ring-signal peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-ink-900',
                selected ? 'border-signal bg-signal text-ink-950' : 'border-white/25',
              )}
            >
              {selected && <Check className="h-3 w-3" strokeWidth={3} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-bone">{m.name}</span>
                <Badge tone={badge.tone} dot>
                  {badge.label}
                </Badge>
                {m.is_default && ready && <Badge tone="signal">Default</Badge>}
              </span>
              <span className="mt-1 block font-mono text-[11px] text-mist">
                {m.id}
                {m.input_size && ` · ${m.input_size[0]}×${m.input_size[1]}`}
              </span>
              {m.note && <span className="mt-2 block text-sm text-mist">{m.note}</span>}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
