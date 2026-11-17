import type { ReactNode } from 'react';
import type { LinkProps } from 'react-router-dom';
import { PageLink } from '../lib/navigation';
import { AlertTriangle, Info, XCircle } from 'lucide-react';
import { Reveal } from './Reveal';

export const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

/* ---------- Buttons ---------- */

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'md' | 'lg';

export function buttonClasses(variant: Variant = 'primary', size: Size = 'md') {
  return cx(
    'group inline-flex select-none items-center justify-center gap-2 rounded-full font-medium transition-all duration-200 ease-out',
    'active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100',
    size === 'md' ? 'h-10 px-5 text-sm' : 'h-12 px-6 text-[15px]',
    variant === 'primary' &&
      'bg-signal text-ink-950 shadow-[0_0_0_1px_rgba(198,243,107,0.4),0_8px_30px_-8px_rgba(198,243,107,0.45)] hover:bg-signal-bright hover:shadow-[0_0_0_1px_rgba(214,250,143,0.6),0_12px_36px_-8px_rgba(198,243,107,0.6)]',
    variant === 'secondary' && 'border border-white/15 text-bone hover:border-white/30 hover:bg-white/[0.04]',
    variant === 'ghost' && 'text-mist hover:text-bone',
  );
}

export function ButtonLink({
  variant,
  size,
  className,
  ...props
}: LinkProps & { variant?: Variant; size?: Size }) {
  return <PageLink {...props} className={cx(buttonClasses(variant, size), className as string)} />;
}

/* ---------- Badges ---------- */

export type Tone = 'signal' | 'real' | 'fake' | 'caution' | 'neutral';

const toneClasses: Record<Tone, string> = {
  signal: 'border-signal/30 bg-signal/10 text-signal',
  real: 'border-real/30 bg-real/10 text-real',
  fake: 'border-fake/30 bg-fake/10 text-fake',
  caution: 'border-caution/30 bg-caution/10 text-caution',
  neutral: 'border-white/10 bg-white/[0.04] text-mist',
};

export function Badge({ tone = 'neutral', children, dot }: { tone?: Tone; children: ReactNode; dot?: boolean }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.12em]',
        toneClasses[tone],
      )}
    >
      {dot && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/* ---------- Alerts ---------- */

export function Alert({
  tone = 'error',
  title,
  children,
  action,
}: {
  tone?: 'error' | 'warning' | 'info';
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const Icon = tone === 'error' ? XCircle : tone === 'warning' ? AlertTriangle : Info;
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cx(
        'flex animate-fade-up-fast gap-3 rounded-xl border p-4 text-sm',
        tone === 'error' && 'border-fake/30 bg-fake/[0.06]',
        tone === 'warning' && 'border-caution/30 bg-caution/[0.06]',
        tone === 'info' && 'border-white/10 bg-white/[0.03]',
      )}
    >
      <Icon
        aria-hidden
        className={cx(
          'mt-0.5 h-4 w-4 shrink-0',
          tone === 'error' && 'text-fake',
          tone === 'warning' && 'text-caution',
          tone === 'info' && 'text-mist',
        )}
      />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-bone">{title}</p>
        {children && <div className="mt-1 text-mist">{children}</div>}
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );
}

/* ---------- Page header ---------- */

export function PageHeader({
  index,
  label,
  title,
  children,
  compact,
  aside,
}: {
  index: string;
  label: string;
  title: ReactNode;
  children?: ReactNode;
  /** Shorter header for task pages (Detect, Results) so the working area is visible on arrival. */
  compact?: boolean;
  /** Optional element shown to the right of the heading on large screens (e.g. branding). */
  aside?: ReactNode;
}) {
  return (
    <header className="relative overflow-hidden border-b hairline">
      <div aria-hidden className="bg-grid mask-fade-b absolute inset-0" />
      <div
        className={cx(
          'shell relative',
          compact ? 'pb-7 pt-9 sm:pb-8 sm:pt-11 short:pb-6 short:pt-7' : 'pb-12 pt-14 sm:pb-16 sm:pt-20',
          !!aside && 'lg:flex lg:items-center lg:justify-between lg:gap-12',
        )}
      >
        <div>
        <p className="eyebrow animate-fade-up">
          <span className="text-signal">{index}</span> <span className="mx-2 text-ink-500">/</span> {label}
        </p>
        <h1
          className={cx(
            'display max-w-4xl animate-fade-up [animation-delay:80ms]',
            compact ? 'mt-4 text-[38px] sm:text-5xl lg:text-[56px]' : 'mt-5 text-[44px] sm:text-6xl lg:text-7xl',
          )}
        >
          {title}
        </h1>
        {children && (
          <div
            className={cx(
              'max-w-2xl animate-fade-up text-mist [animation-delay:160ms]',
              compact ? 'mt-3 text-[15px] sm:text-base' : 'mt-6 text-base sm:text-lg',
            )}
          >
            {children}
          </div>
        )}
        </div>
        {aside && <div className="hidden shrink-0 animate-scale-in [animation-delay:200ms] lg:block">{aside}</div>}
      </div>
    </header>
  );
}

/* ---------- Specimen frame: corner brackets + mono captions ---------- */

export function SpecimenFrame({
  children,
  topLeft,
  topRight,
  bottomLeft,
  bottomRight,
  className,
  active,
}: {
  children: ReactNode;
  topLeft?: ReactNode;
  topRight?: ReactNode;
  bottomLeft?: ReactNode;
  bottomRight?: ReactNode;
  className?: string;
  active?: boolean;
}) {
  const corner = cx('absolute h-4 w-4 transition-colors duration-300', active ? 'border-signal' : 'border-bone/50');
  const caption = 'font-mono text-[10px] uppercase tracking-[0.16em] text-mist truncate';
  return (
    <div className={cx('relative p-3 sm:p-4', className)}>
      <span aria-hidden className={cx(corner, 'left-0 top-0 border-l border-t')} />
      <span aria-hidden className={cx(corner, 'right-0 top-0 border-r border-t')} />
      <span aria-hidden className={cx(corner, 'bottom-0 left-0 border-b border-l')} />
      <span aria-hidden className={cx(corner, 'bottom-0 right-0 border-b border-r')} />
      {(topLeft || topRight) && (
        <div className="mb-2.5 flex items-center justify-between gap-4 px-1">
          <span className={caption}>{topLeft}</span>
          <span className={caption}>{topRight}</span>
        </div>
      )}
      {children}
      {(bottomLeft || bottomRight) && (
        <div className="mt-2.5 flex items-center justify-between gap-4 px-1">
          <span className={caption}>{bottomLeft}</span>
          <span className={caption}>{bottomRight}</span>
        </div>
      )}
    </div>
  );
}

/* ---------- Section heading ---------- */

export function SectionHeading({ eyebrow, title, children }: { eyebrow: string; title: ReactNode; children?: ReactNode }) {
  return (
    <Reveal className="max-w-2xl">
      <p className="eyebrow flex items-center gap-3">
        <span aria-hidden className="reveal-rule h-px w-6 bg-signal" />
        {eyebrow}
      </p>
      <h2 className="display mt-4 text-4xl sm:text-5xl">{title}</h2>
      {children && <p className="mt-4 text-mist">{children}</p>}
    </Reveal>
  );
}
