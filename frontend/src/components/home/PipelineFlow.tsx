import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { BadgeCheck, GitMerge, Microscope, ScanFace, Upload } from 'lucide-react';
import { Reveal, stagger, useReveal } from '../Reveal';
import { cx } from '../ui';

/*
 * The five stages of an analysis. "now" describes exactly what the current
 * backend does; "full" describes the wider architecture where a stage isn't
 * fully active yet. Nothing unimplemented is presented as running.
 */
const STEPS = [
  {
    icon: Upload,
    title: 'Image upload',
    now: 'Drop, browse or paste a JPG, PNG or WebP up to 10 MB. The browser checks the real format from the file’s signature, the size and that it decodes; the server validates it again before analysis.',
    facts: ['JPG · PNG · WebP', 'Up to 10 MB', 'Checked twice'],
  },
  {
    icon: ScanFace,
    title: 'Face detection & preprocessing',
    now: 'The server decodes the image to RGB, resizes the whole frame to 256 × 256 and applies ImageNet normalisation. Face detection is not part of the current pipeline, so the full image is analysed.',
    full: 'MTCNN locates and aligns each face into its own 256 × 256 crop before analysis.',
    facts: ['RGB', '256 × 256', 'ImageNet mean / std'],
  },
  {
    icon: Microscope,
    title: 'Forensic analysis',
    now: 'Swin Transformer V2 examines the resized image, weighing fine texture in skin, eyes and hair against the overall structure of the face, and scores each class.',
    full: 'Frequency-residual (SRM), blending-boundary and depth-geometry branches add independent forensic evidence.',
    facts: ['Swin Transformer V2', '27.6 M parameters', 'GPU or CPU'],
  },
  {
    icon: GitMerge,
    title: 'Model fusion',
    now: 'With a single model in the pipeline, its class scores pass straight through. No fusion step is applied to the result.',
    full: 'A late-fusion layer weighs every branch into one verdict, with a per-branch breakdown.',
    facts: ['One active model', 'Scores pass through'],
  },
  {
    icon: BadgeCheck,
    title: 'Final prediction',
    now: 'The class with the higher score, Real or Fake, becomes the verdict. It’s reported with both class scores, inference time and device, and can be exported as a PDF or JSON report.',
    note: 'Scores are softmax outputs of the model, not calibrated probabilities.',
    facts: ['Real / Fake', 'Class scores', 'PDF · JSON'],
  },
] as const;

type Step = (typeof STEPS)[number];
const pad = (n: number) => String(n).padStart(2, '0');

function Facts({ facts }: { facts: readonly string[] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {facts.map((f) => (
        <li key={f} className="rounded-full border border-signal/25 bg-signal/[0.06] px-3 py-1 font-mono text-[11px] text-bone/90">
          {f}
        </li>
      ))}
    </ul>
  );
}

function StepBody({ step }: { step: Step }) {
  return (
    <div className="grid gap-6 md:grid-cols-12 md:gap-10">
      <div className="md:col-span-7">
        <p className="eyebrow !text-[10px]">Current pipeline</p>
        <p className="mt-2 leading-relaxed text-bone/90">{step.now}</p>
        {'note' in step && <p className="mt-3 text-sm text-mist">{step.note}</p>}
        <div className="mt-5">
          <Facts facts={step.facts} />
        </div>
      </div>
      {'full' in step && (
        <div className="md:col-span-5 md:border-l md:border-white/[0.07] md:pl-8">
          <p className="eyebrow !text-[10px]">In the full architecture</p>
          <p className="mt-2 text-sm leading-relaxed text-mist">{step.full}</p>
        </div>
      )}
    </div>
  );
}

/** Desktop / tablet: five connected nodes; hovering or selecting one reveals its detail. */
function InteractiveFlow() {
  const [active, setActive] = useState(0);
  const [ref, visible] = useReveal<HTMLDivElement>();
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const hoverTimer = useRef<number>();

  useEffect(() => () => window.clearTimeout(hoverTimer.current), []);

  const select = (i: number, focus = false) => {
    window.clearTimeout(hoverTimer.current);
    setActive(i);
    if (focus) tabs.current[i]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const last = STEPS.length - 1;
    const next =
      e.key === 'ArrowRight' ? Math.min(active + 1, last)
      : e.key === 'ArrowLeft' ? Math.max(active - 1, 0)
      : e.key === 'Home' ? 0
      : e.key === 'End' ? last
      : null;
    if (next === null) return;
    e.preventDefault();
    select(next, true);
  };

  const step = STEPS[active];
  // Fraction of the track between the first and the selected node; draws in once visible.
  const fill = visible ? active / (STEPS.length - 1) : 0;

  return (
    <div ref={ref}>
      <div className="relative">
        {/* Track spans node centre to node centre (each column is 1/5 wide). */}
        <div aria-hidden className="absolute left-[10%] right-[10%] top-[27px] h-px bg-white/10">
          <div
            className="h-full origin-left bg-gradient-to-r from-signal/40 to-signal transition-transform duration-700 ease-out-expo"
            style={{ transform: `scaleX(${fill})` }}
          />
        </div>

        <div
          role="tablist"
          aria-label="Analysis pipeline stages"
          onKeyDown={onKeyDown}
          onPointerLeave={() => window.clearTimeout(hoverTimer.current)}
          className="relative grid grid-cols-5"
        >
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const selected = i === active;
            const passed = i < active;
            return (
              <Reveal key={s.title} variant="scale" delay={stagger(i, 90)} className="flex justify-center">
                <button
                  ref={(el) => (tabs.current[i] = el)}
                  type="button"
                  role="tab"
                  id={`flow-tab-${i}`}
                  aria-selected={selected}
                  aria-controls="flow-panel"
                  tabIndex={selected ? 0 : -1}
                  onClick={() => select(i)}
                  onPointerEnter={(e) => {
                    if (e.pointerType !== 'mouse') return;
                    window.clearTimeout(hoverTimer.current);
                    hoverTimer.current = window.setTimeout(() => setActive(i), 130);
                  }}
                  className="group flex flex-col items-center px-2 text-center"
                >
                  <span
                    className={cx(
                      'relative flex h-14 w-14 items-center justify-center rounded-2xl border transition-all duration-500 ease-out-expo',
                      selected && 'scale-110 border-signal bg-signal text-ink-950 shadow-[0_0_0_6px_rgba(198,243,107,0.1),0_10px_30px_-10px_rgba(198,243,107,0.6)]',
                      passed && 'border-signal/50 bg-ink-950 text-signal',
                      !selected && !passed && 'border-white/[0.12] bg-ink-950 text-mist group-hover:border-white/30 group-hover:text-bone',
                    )}
                  >
                    <Icon aria-hidden className="h-6 w-6" strokeWidth={1.5} />
                  </span>
                  <span className={cx('mt-4 font-mono text-[11px] transition-colors', selected || passed ? 'text-signal' : 'text-mist')}>
                    {pad(i + 1)}
                  </span>
                  <span
                    className={cx(
                      'mt-1 text-sm leading-snug transition-colors duration-300',
                      selected ? 'text-bone' : 'text-mist group-hover:text-bone',
                    )}
                  >
                    {s.title}
                  </span>
                </button>
              </Reveal>
            );
          })}
        </div>
      </div>

      <div
        id="flow-panel"
        role="tabpanel"
        aria-labelledby={`flow-tab-${active}`}
        className="panel relative mt-10 overflow-hidden p-7 lg:p-9"
      >
        <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-signal/[0.06] blur-[80px]" />
        <div key={active} className="relative animate-fade-up-fast">
          <div className="mb-6 flex items-baseline justify-between gap-4">
            <h3 className="display text-4xl lg:text-5xl">{step.title}</h3>
            <span className="font-mono text-[11px] text-mist">
              <span className="text-signal">{pad(active + 1)}</span> / {pad(STEPS.length)}
            </span>
          </div>
          <StepBody step={step} />
        </div>
      </div>
    </div>
  );
}

/** Mobile: every stage visible as a vertical timeline. */
function StackedFlow() {
  return (
    <Reveal variant="fade" className="relative">
      <span
        aria-hidden
        className="reveal-spine absolute bottom-8 left-[23px] top-8 w-px bg-gradient-to-b from-signal/60 via-white/[0.12] to-white/[0.07]"
      />
      <ol className="space-y-5">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          return (
            <Reveal as="li" key={s.title} delay={stagger(i, 60)} className="relative flex gap-4">
              <span className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-signal/50 bg-ink-950 text-signal">
                <Icon aria-hidden className="h-5 w-5" strokeWidth={1.5} />
              </span>
              <div className="panel min-w-0 flex-1 p-5">
                <p className="font-mono text-[11px] text-signal">{pad(i + 1)}</p>
                <h3 className="display mt-1 text-3xl">{s.title}</h3>
                <div className="mt-4">
                  <StepBody step={s} />
                </div>
              </div>
            </Reveal>
          );
        })}
      </ol>
    </Reveal>
  );
}

export function PipelineFlow() {
  return (
    <>
      <div className="hidden md:block">
        <InteractiveFlow />
      </div>
      <div className="md:hidden">
        <StackedFlow />
      </div>
    </>
  );
}
