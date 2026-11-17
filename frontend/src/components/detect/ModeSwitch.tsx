import { useRef, type KeyboardEvent } from 'react';
import { cx } from '../ui';

export type AnalysisMode = 'standard' | 'advanced';

const OPTIONS: Array<{ value: AnalysisMode; label: string; hint: string }> = [
  { value: 'standard', label: 'Standard', hint: 'Runs the service’s configured analysis pipeline automatically.' },
  { value: 'advanced', label: 'Advanced', hint: 'Choose which available model analyses the image.' },
];

/** Two-option segmented control with a sliding indicator (radio-group semantics). */
export function ModeSwitch({
  value,
  onChange,
  disabled,
}: {
  value: AnalysisMode;
  onChange: (mode: AnalysisMode) => void;
  disabled?: boolean;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const index = OPTIONS.findIndex((o) => o.value === value);

  const onKeyDown = (e: KeyboardEvent) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    const next = (index + 1) % OPTIONS.length;
    onChange(OPTIONS[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div>
      <div
        role="radiogroup"
        aria-label="Analysis mode"
        onKeyDown={onKeyDown}
        className={cx(
          'relative grid grid-cols-2 rounded-full border border-white/10 bg-ink-950/60 p-1',
          disabled && 'pointer-events-none opacity-50',
        )}
      >
        <span
          aria-hidden
          className="absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full border border-signal/30 bg-signal/[0.1] transition-transform duration-500 ease-out-expo"
          style={{ transform: `translateX(${index * 100}%)` }}
        />
        {OPTIONS.map((o, i) => (
          <button
            key={o.value}
            ref={(el) => (refs.current[i] = el)}
            type="button"
            role="radio"
            aria-checked={o.value === value}
            tabIndex={o.value === value ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={cx(
              'relative z-10 rounded-full py-2 text-sm font-medium transition-colors duration-300',
              o.value === value ? 'text-signal' : 'text-mist hover:text-bone',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      <p key={value} className="mt-2.5 animate-fade-up-fast text-xs text-mist">
        {OPTIONS[index].hint}
      </p>
    </div>
  );
}
