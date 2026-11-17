import { Check } from 'lucide-react';
import { cx } from '../ui';

const LABELS = ['Upload', 'Analyse', 'Review'];

/** Upload → Analyse → Review. A progress indicator for the current session only. */
export function Steps({ current, busy }: { current: 0 | 1 | 2; busy: boolean }) {
  return (
    <ol className="flex items-center" aria-label="Progress">
      {LABELS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className={cx('flex items-center', i < LABELS.length - 1 && 'flex-1')}>
            <span className="flex items-center gap-2 sm:gap-2.5" aria-current={active ? 'step' : undefined}>
              <span
                className={cx(
                  'relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border font-mono text-[11px] transition-all duration-500 ease-out-expo',
                  done && 'border-signal bg-signal text-ink-950',
                  active && 'border-signal text-signal shadow-[0_0_0_4px_rgba(198,243,107,0.1)]',
                  !done && !active && 'border-white/15 text-mist',
                )}
              >
                {done ? <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
                {active && busy && (
                  <span aria-hidden className="absolute inset-0 animate-ping rounded-full border border-signal/60" />
                )}
              </span>
              <span
                className={cx(
                  'text-[13px] transition-colors duration-300 sm:text-sm',
                  active || done ? 'text-bone' : 'text-mist',
                )}
              >
                {label}
              </span>
            </span>
            {i < LABELS.length - 1 && (
              <span aria-hidden className="mx-2 h-px min-w-5 flex-1 overflow-hidden bg-white/10 sm:mx-3">
                <span
                  className={cx(
                    'block h-full origin-left bg-signal transition-transform duration-700 ease-out-expo',
                    done ? 'scale-x-100' : 'scale-x-0',
                  )}
                />
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
