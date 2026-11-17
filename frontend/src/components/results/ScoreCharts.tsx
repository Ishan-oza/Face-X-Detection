import { useState } from 'react';
import type { ClassScore } from '../../lib/report/buildReport';
import { cx, type Tone } from '../ui';
import { clamp, toneFill, toneFor, toneStroke, useMounted } from './shared';

/** Ring showing the predicted class's score. */
export function ScoreRing({ value, tone }: { value: number; tone: Tone }) {
  const mounted = useMounted();
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-36 w-36 shrink-0 sm:h-40 sm:w-40">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="60" cy="60" r={r} fill="none" className="stroke-white/[0.07]" strokeWidth="6" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          className={cx(toneStroke[tone], 'transition-[stroke-dashoffset] duration-1000 ease-out')}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - (mounted ? clamp(value) : 0) / 100)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-2xl tabular-nums text-bone sm:text-[28px]">{value.toFixed(1)}%</span>
        <span className="eyebrow mt-1 !text-[9.5px]">Model score</span>
      </div>
    </div>
  );
}

/**
 * Part-to-whole split of class scores (they sum to 100), in the model's class
 * order so colour always follows the class. Direct labels carry identity, so
 * colour is never the only cue; the dashed line marks the 50% decision point.
 */
export function ScoreBalance({ scores }: { scores: ClassScore[] }) {
  const mounted = useMounted();
  const [hover, setHover] = useState<string | null>(null);
  const even = 100 / Math.max(1, scores.length);

  return (
    <figure>
      <div className="flex items-end justify-between gap-4">
        {scores.map((s, i) => (
          <div key={s.label} className={cx('min-w-0', i === scores.length - 1 && scores.length > 1 && 'text-right')}>
            <div className="flex items-center gap-2 text-sm text-bone" style={{ justifyContent: i === scores.length - 1 && scores.length > 1 ? 'flex-end' : undefined }}>
              <span aria-hidden className={cx('h-2.5 w-2.5 rounded-sm', toneFill[toneFor(s.label)])} />
              {s.label}
            </div>
            <div className="mt-1 font-mono text-xl tabular-nums text-bone">{s.value.toFixed(2)}%</div>
          </div>
        ))}
      </div>

      <div className="relative mt-4">
        <div className="flex h-3 gap-[2px]" role="img" aria-label={scores.map((s) => `${s.label} ${s.value.toFixed(2)}%`).join(', ')}>
          {scores.map((s, i) => (
            <div
              key={s.label}
              onMouseEnter={() => setHover(s.label)}
              onMouseLeave={() => setHover(null)}
              className={cx(
                'relative h-full transition-[flex-basis,opacity] duration-1000 ease-out-expo',
                toneFill[toneFor(s.label)],
                i === 0 && 'rounded-l',
                i === scores.length - 1 && 'rounded-r',
                hover && hover !== s.label && 'opacity-40',
              )}
              style={{ flexBasis: `${mounted ? clamp(s.value) : even}%` }}
            >
              {hover === s.label && (
                <span className="absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/10 bg-ink-800 px-2.5 py-1.5 font-mono text-[11px] text-bone shadow-lg">
                  {s.label}: {s.value.toFixed(4)}%
                </span>
              )}
            </div>
          ))}
        </div>
        {scores.length === 2 && (
          <span aria-hidden className="absolute -bottom-1.5 -top-1.5 left-1/2 w-0 border-l border-dashed border-bone/50" />
        )}
      </div>
      {scores.length === 2 && (
        <figcaption className="mt-3 text-center font-mono text-[10px] uppercase tracking-[0.14em] text-mist">
          Dashed line · 50% decision point
        </figcaption>
      )}
    </figure>
  );
}
