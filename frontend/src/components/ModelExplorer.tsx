import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, ChevronDown } from 'lucide-react';
import { PageLink } from '../lib/navigation';
import { SWIN_REASONS, SWIN_SPEC, SWIN_TRAINING, type ModelCard } from '../data/project';
import { useMediaQuery } from '../lib/hooks';
import { cx } from './ui';

const pad = (n: number) => String(n).padStart(2, '0');

/* ------------------------------------------------------------------ */
/* Shared detail content                                               */
/* ------------------------------------------------------------------ */

function FactList({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl>
      {rows.map(([k, v]) => (
        <div key={k} className="grid grid-cols-5 gap-4 border-b border-white/[0.05] py-3 last:border-0">
          <dt className="col-span-2 text-sm text-mist">{k}</dt>
          <dd className="col-span-3 font-mono text-[12.5px] text-bone">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Overview({ model }: { model: ModelCard }) {
  return (
    <div className="animate-fade-up-fast">
      <p className="leading-relaxed text-mist">{model.detail}</p>

      <p className="eyebrow mt-7">Key points</p>
      <ul className="mt-3 space-y-2.5">
        {model.points.map((p, i) => (
          <li
            key={p}
            className="flex animate-fade-up-fast gap-3 text-sm text-bone/90"
            style={{ animationDelay: `${80 + i * 60}ms` }}
          >
            <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rotate-45 bg-signal" />
            {p}
          </li>
        ))}
      </ul>

      <dl className="mt-7 grid gap-4 border-t hairline pt-5 text-xs sm:grid-cols-2">
        <div>
          <dt className="eyebrow !text-[10px]">Input</dt>
          <dd className="mt-1.5 font-mono text-[12.5px] leading-relaxed text-bone/90">{model.input}</dd>
        </div>
        <div>
          <dt className="eyebrow !text-[10px]">Output</dt>
          <dd className="mt-1.5 font-mono text-[12.5px] leading-relaxed text-bone/90">{model.output}</dd>
        </div>
      </dl>
    </div>
  );
}

function SwinDesign() {
  return (
    <div className="grid gap-x-6 gap-y-6 sm:grid-cols-2">
      {SWIN_REASONS.map((r, i) => (
        <article key={r.title} className="animate-fade-up-fast" style={{ animationDelay: `${i * 60}ms` }}>
          <span className="font-mono text-[11px] text-signal">{pad(i + 1)}</span>
          <h4 className="mt-1.5 font-medium text-bone">{r.title}</h4>
          <p className="mt-1.5 text-sm leading-relaxed text-mist">{r.body}</p>
        </article>
      ))}
    </div>
  );
}

function SwinSpecification() {
  return (
    <div className="animate-fade-up-fast">
      <FactList rows={SWIN_SPEC} />
      <details className="group mt-3 border-t hairline pt-1">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-md py-2.5 text-sm text-bone transition-colors hover:text-signal [&::-webkit-details-marker]:hidden">
          Training details
          <ChevronDown
            aria-hidden
            className="h-4 w-4 text-mist transition-transform duration-300 ease-out-expo group-open:rotate-180"
          />
        </summary>
        <div className="animate-fade-up-fast">
          <FactList rows={SWIN_TRAINING} />
        </div>
      </details>
      <p className="mt-4 text-xs text-mist">Source: the project’s training notebook and model checkpoint.</p>
    </div>
  );
}

/** Segmented control for models with more than one view. Keyboard: arrow keys. */
function InnerTabs({ id, tabs }: { id: string; tabs: Array<{ label: string; content: ReactNode }> }) {
  const [active, setActive] = useState(0);
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (e: KeyboardEvent) => {
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (active + delta + tabs.length) % tabs.length;
    setActive(next);
    refs.current[next]?.focus();
  };

  return (
    <div>
      <div
        role="tablist"
        aria-label="Detail view"
        onKeyDown={onKeyDown}
        className="relative inline-flex rounded-full border border-white/10 bg-ink-950/60 p-1"
      >
        {tabs.map((t, i) => (
          <button
            key={t.label}
            ref={(el) => (refs.current[i] = el)}
            type="button"
            role="tab"
            id={`${id}-tab-${i}`}
            aria-selected={i === active}
            aria-controls={`${id}-view-${i}`}
            tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
            className={cx(
              'relative rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors duration-200 sm:px-4',
              i === active ? 'bg-white/[0.08] text-bone' : 'text-mist hover:text-bone',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div
        key={active}
        role="tabpanel"
        id={`${id}-view-${active}`}
        aria-labelledby={`${id}-tab-${active}`}
        className="mt-6"
      >
        {tabs[active].content}
      </div>
    </div>
  );
}

function DetailBody({ model, idPrefix }: { model: ModelCard; idPrefix: string }) {
  if (model.id !== 'swin') return <Overview model={model} />;
  return (
    <>
      <InnerTabs
        id={`${idPrefix}-swin`}
        tabs={[
          { label: 'Overview', content: <Overview model={model} /> },
          { label: 'Design', content: <SwinDesign /> },
          { label: 'Specification', content: <SwinSpecification /> },
        ]}
      />
      <PageLink
        to="/detect"
        className="group mt-7 inline-flex items-center gap-1.5 text-sm text-signal underline decoration-signal/30 underline-offset-4 transition-colors hover:decoration-signal"
      >
        Analyse an image with Swin Transformer V2
        <ArrowRight aria-hidden className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </PageLink>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Desktop: list + sticky detail panel                                 */
/* ------------------------------------------------------------------ */

function DesktopExplorer({ models, initial }: { models: ModelCard[]; initial: number }) {
  const [active, setActive] = useState(initial);
  const hoverTimer = useRef<number>();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => () => window.clearTimeout(hoverTimer.current), []);

  // Short hover intent so sweeping the pointer across the list doesn't flicker the panel.
  // Only real mouse pointers preview on hover; touch and pen select on tap.
  const onEnter = (e: PointerEvent, i: number) => {
    if (e.pointerType !== 'mouse') return;
    window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => setActive(i), 140);
  };
  const onLeave = () => window.clearTimeout(hoverTimer.current);

  const select = (i: number, focus = false) => {
    window.clearTimeout(hoverTimer.current);
    setActive(i);
    if (focus) tabRefs.current[i]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const last = models.length - 1;
    const next =
      e.key === 'ArrowDown' ? Math.min(active + 1, last)
      : e.key === 'ArrowUp' ? Math.max(active - 1, 0)
      : e.key === 'Home' ? 0
      : e.key === 'End' ? last
      : null;
    if (next === null) return;
    e.preventDefault();
    select(next, true);
  };

  const model = models[active];
  const prev = models[active - 1];
  const next = models[active + 1];

  return (
    <div className="grid grid-cols-12 gap-8">
      <div
        role="tablist"
        aria-orientation="vertical"
        aria-label="Models and components"
        onKeyDown={onKeyDown}
        onPointerLeave={onLeave}
        className="col-span-5 space-y-2"
      >
        {models.map((m, i) => {
          const selected = i === active;
          return (
            <button
              key={m.id}
              ref={(el) => (tabRefs.current[i] = el)}
              type="button"
              role="tab"
              id={`model-tab-${m.id}`}
              aria-selected={selected}
              aria-controls="model-panel"
              tabIndex={selected ? 0 : -1}
              onClick={() => select(i)}
              onPointerEnter={(e) => onEnter(e, i)}
              className={cx(
                'group relative flex w-full items-center gap-4 overflow-hidden rounded-xl border px-5 py-4 text-left',
                'transition-[background-color,border-color,box-shadow] duration-300 ease-out-expo',
                selected
                  ? 'border-signal/40 bg-signal/[0.045] shadow-[0_10px_30px_-18px_rgba(198,243,107,0.35)]'
                  : 'border-white/[0.06] bg-ink-900/50 hover:border-white/15 hover:bg-ink-900',
              )}
            >
              <span
                aria-hidden
                className={cx(
                  'absolute inset-y-3 left-0 w-[2px] rounded-full bg-signal transition-transform duration-500 ease-out-expo',
                  selected ? 'scale-y-100' : 'scale-y-0',
                )}
              />
              <span
                className={cx(
                  'w-6 shrink-0 font-mono text-[11px] transition-colors',
                  selected ? 'text-signal' : 'text-mist',
                )}
              >
                {pad(i + 1)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-3">
                  <span
                    className={cx(
                      'display truncate text-[26px] transition-transform duration-300 ease-out-expo',
                      selected ? 'translate-x-1 text-bone' : 'text-bone/85 group-hover:translate-x-1',
                    )}
                  >
                    {m.name}
                  </span>
                  <span className="eyebrow hidden shrink-0 !text-[9.5px] xl:inline">{m.group}</span>
                </span>
                <span className="mt-1 block truncate text-sm text-mist">{m.role}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="col-span-7">
        <div
          role="tabpanel"
          id="model-panel"
          aria-labelledby={`model-tab-${model.id}`}
          className="panel sticky top-36 min-h-[560px] overflow-hidden p-8 xl:p-10"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-signal/[0.06] blur-[90px]"
          />
          <div key={model.id} className="relative">
            <div className="flex animate-fade-up-fast items-center justify-between gap-4">
              <p className="eyebrow">{model.group}</p>
              <p className="font-mono text-[11px] text-mist">
                <span className="text-signal">{pad(active + 1)}</span> / {pad(models.length)}
              </p>
            </div>
            <h3 className="display mt-5 animate-fade-up-fast text-5xl xl:text-6xl">{model.name}</h3>
            <p className="mt-3 animate-fade-up-fast text-lg text-bone [animation-delay:40ms]">{model.role}</p>
            <div className="mt-7">
              <DetailBody model={model} idPrefix="desktop" />
            </div>
          </div>

          <div className="relative mt-10 flex items-center justify-between gap-4 border-t hairline pt-5">
            <button
              type="button"
              onClick={() => prev && select(active - 1)}
              disabled={!prev}
              className="group inline-flex items-center gap-2 text-sm text-mist transition-colors hover:text-bone disabled:invisible"
            >
              <ArrowLeft aria-hidden className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
              {prev?.name}
            </button>
            <button
              type="button"
              onClick={() => next && select(active + 1)}
              disabled={!next}
              className="group inline-flex items-center gap-2 text-sm text-mist transition-colors hover:text-bone disabled:invisible"
            >
              {next?.name}
              <ArrowRight aria-hidden className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Mobile / tablet: accordion                                          */
/* ------------------------------------------------------------------ */

function AccordionItem({
  model,
  index,
  open,
  onToggle,
}: {
  model: ModelCard;
  index: number;
  open: boolean;
  onToggle: () => void;
}) {
  const regionRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLButtonElement>(null);

  // Collapsed content stays mounted for the height animation, so take it out of the tab order.
  useEffect(() => {
    regionRef.current?.toggleAttribute('inert', !open);
    if (open) {
      const id = window.setTimeout(() => headerRef.current?.scrollIntoView({ block: 'nearest' }), 320);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  return (
    <div
      className={cx(
        'overflow-hidden rounded-xl border transition-[background-color,border-color] duration-300',
        open ? 'border-signal/40 bg-signal/[0.035]' : 'border-white/[0.07] bg-ink-900/50',
      )}
    >
      {/* Normal wrapping: the global balanced wrap for headings squeezes the role line. */}
      <h3 className="[text-wrap:wrap]">
        <button
          ref={headerRef}
          type="button"
          id={`model-acc-${model.id}`}
          aria-expanded={open}
          aria-controls={`model-acc-panel-${model.id}`}
          onClick={onToggle}
          className="flex w-full items-center gap-4 px-5 py-4 text-left active:bg-white/[0.02]"
        >
          <span className={cx('w-6 shrink-0 font-mono text-[11px]', open ? 'text-signal' : 'text-mist')}>
            {pad(index + 1)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="eyebrow block !text-[9.5px]">{model.group}</span>
            <span className="display mt-1 block text-[26px] text-bone">{model.name}</span>
            <span className="mt-0.5 block text-sm text-mist">{model.role}</span>
          </span>
          <ChevronDown
            aria-hidden
            className={cx(
              'h-5 w-5 shrink-0 text-mist transition-transform duration-500 ease-out-expo',
              open && 'rotate-180 text-signal',
            )}
          />
        </button>
      </h3>
      <div
        ref={regionRef}
        id={`model-acc-panel-${model.id}`}
        role="region"
        aria-labelledby={`model-acc-${model.id}`}
        className={cx(
          'grid transition-[grid-template-rows] duration-500 ease-out-expo',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="min-h-0 overflow-hidden">
          {/* Re-keyed on open so the content's entrance animation plays each time. */}
          <div key={String(open)} className="border-t hairline px-5 pb-6 pt-5">
            <DetailBody model={model} idPrefix={`mobile-${model.id}`} />
          </div>
        </div>
      </div>
    </div>
  );
}

function MobileExplorer({ models }: { models: ModelCard[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <div className="space-y-2.5">
      {models.map((m, i) => (
        <AccordionItem
          key={m.id}
          model={m}
          index={i}
          open={openId === m.id}
          onToggle={() => setOpenId((cur) => (cur === m.id ? null : m.id))}
        />
      ))}
    </div>
  );
}

/**
 * Interactive model directory. On large screens, hovering or selecting a
 * model shows its full detail in a sticky panel; on smaller screens each
 * model expands in place.
 */
export function ModelExplorer({ models, initialId }: { models: ModelCard[]; initialId?: string }) {
  const desktop = useMediaQuery('(min-width: 1024px)');
  const initial = Math.max(0, models.findIndex((m) => m.id === initialId));
  return desktop ? <DesktopExplorer models={models} initial={initial} /> : <MobileExplorer models={models} />;
}
