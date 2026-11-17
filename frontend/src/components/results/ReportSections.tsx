import type { ReactNode } from 'react';
import { Globe, Monitor, Server, Settings2 } from 'lucide-react';
import type { Fact, ModelOutput, PipelineStage, Source } from '../../lib/report/buildReport';
import { Reveal, stagger } from '../Reveal';
import { Badge, cx } from '../ui';
import { clamp, toneFill, toneFor, toneText, useMounted } from './shared';

/* ---------------- Model outputs ---------------- */

/** One card per integrated model; each includes a table view of its class scores. */
export function ModelOutputs({ models, verdictSource }: { models: ModelOutput[]; verdictSource: string }) {
  const mounted = useMounted();
  return (
    <div className="grid gap-5">
      {models.map((m, i) => (
        <Reveal key={m.id ?? m.name} delay={stagger(i)}>
          <article className="panel p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="display text-3xl sm:text-4xl">{m.name}</h3>
                <p className="mt-1.5 font-mono text-xs text-mist">
                  {m.architecture}
                  {m.id && ` · id ${m.id}`}
                </p>
              </div>
              {m.name === verdictSource && <Badge tone="signal">Source of final verdict</Badge>}
            </div>

            <div className="mt-6 grid gap-6 border-t hairline pt-6 md:grid-cols-12">
              <div className="md:col-span-4">
                <p className="eyebrow">Prediction</p>
                <p className={cx('display mt-2 text-5xl uppercase', toneText[toneFor(m.label)])}>{m.label}</p>
                <p className="mt-2 text-sm text-mist">
                  Score <span className="font-mono text-bone">{m.score.toFixed(2)}%</span>
                </p>
              </div>

              <div className="md:col-span-8">
                <table className="w-full text-sm">
                  <caption className="eyebrow mb-3 text-left">Class scores (softmax)</caption>
                  <thead className="sr-only">
                    <tr>
                      <th scope="col">Class</th>
                      <th scope="col">Score</th>
                      <th scope="col">Bar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {m.scores.map((s) => (
                      <tr key={s.label} className="border-b border-white/[0.05] last:border-0">
                        <th scope="row" className="w-20 py-3 text-left font-normal text-bone">
                          {s.label}
                        </th>
                        <td className="w-28 py-3 font-mono tabular-nums text-bone">{s.value.toFixed(4)}%</td>
                        <td className="py-3">
                          <div className="h-1.5 rounded bg-white/[0.06]">
                            <div
                              className={cx('h-full rounded transition-[width] duration-1000 ease-out-expo', toneFill[toneFor(s.label)])}
                              style={{ width: `${mounted ? clamp(s.value) : 0}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <dl className="mt-6 grid grid-cols-2 gap-4 border-t hairline pt-5 text-sm sm:grid-cols-3">
              <div>
                <dt className="eyebrow !text-[10px]">Device</dt>
                <dd className="mt-1 font-mono text-bone">{m.device ?? 'Not reported'}</dd>
              </div>
              <div>
                <dt className="eyebrow !text-[10px]">Inference time</dt>
                <dd className="mt-1 font-mono text-bone">{m.inferenceMs !== undefined ? `${m.inferenceMs.toFixed(1)} ms` : 'Not reported'}</dd>
              </div>
              <div>
                <dt className="eyebrow !text-[10px]">Input size</dt>
                <dd className="mt-1 font-mono text-bone">{m.inputSize ? `${m.inputSize[0]} × ${m.inputSize[1]}` : 'Not reported'}</dd>
              </div>
            </dl>
          </article>
        </Reveal>
      ))}
      <p className="text-sm text-mist">
        {models.length === 1
          ? 'One model is integrated. The final verdict is taken directly from its output; no fusion step is applied.'
          : `${models.length} models contributed to this analysis.`}
      </p>
    </div>
  );
}

/* ---------------- Pipeline ---------------- */

const SOURCE: Record<Source, { label: string; icon: typeof Globe; tone: 'neutral' | 'signal' }> = {
  browser: { label: 'Browser', icon: Monitor, tone: 'neutral' },
  server: { label: 'Server', icon: Server, tone: 'signal' },
  configuration: { label: 'Configuration', icon: Settings2, tone: 'neutral' },
};

export function PipelineTimeline({ stages }: { stages: PipelineStage[] }) {
  return (
    <Reveal variant="fade" className="relative">
      <span
        aria-hidden
        className="reveal-spine absolute bottom-6 left-[15px] top-6 w-px bg-gradient-to-b from-signal/60 via-white/[0.12] to-white/[0.07]"
      />
      <ol className="space-y-4">
        {stages.map((s, i) => {
          const src = SOURCE[s.source];
          const Icon = src.icon;
          return (
            <Reveal as="li" key={s.key} delay={stagger(i, 60)} className="relative flex gap-5">
              <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-signal/50 bg-ink-950 font-mono text-[11px] text-signal">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="panel min-w-0 flex-1 p-5 transition-colors duration-300 hover:border-white/[0.14]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-medium text-bone">{s.title}</h3>
                  <Badge tone={src.tone}>
                    <Icon aria-hidden className="h-3 w-3" /> {src.label}
                  </Badge>
                </div>
                <p className="mt-1.5 text-sm text-mist">{s.summary}</p>
                {s.facts.length > 0 && (
                  <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                    {s.facts.map(([k, v]) => (
                      <div key={k} className="flex items-baseline justify-between gap-3 border-b border-white/[0.05] pb-2">
                        <dt className="text-mist">{k}</dt>
                        <dd className="text-right font-mono text-[12.5px] text-bone">{v}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            </Reveal>
          );
        })}
      </ol>
      <p className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-mist">
        <span><strong className="font-medium text-bone">Browser</strong> · checked or measured in this browser</span>
        <span><strong className="font-medium text-bone">Server</strong> · reported by the analysis service</span>
        <span><strong className="font-medium text-bone">Configuration</strong> · the model’s published settings</span>
      </p>
    </Reveal>
  );
}

/* ---------------- Facts ---------------- */

export function FactGrid({ facts }: { facts: Fact[] }) {
  return (
    <dl className="grid gap-x-10 sm:grid-cols-2">
      {facts.map(([k, v]) => (
        <div key={k} className="flex items-baseline justify-between gap-4 border-b border-white/[0.05] py-3">
          <dt className="shrink-0 text-sm text-mist">{k}</dt>
          <dd className="min-w-0 break-words text-right text-sm text-bone">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ReportSection({
  id,
  eyebrow,
  title,
  children,
  aside,
}: {
  id: string;
  eyebrow: string;
  title: ReactNode;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28 md:scroll-mt-36 border-b hairline">
      <div className="shell py-16 sm:py-20">
        <Reveal className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow flex items-center gap-3">
              <span aria-hidden className="reveal-rule h-px w-6 bg-signal" />
              {eyebrow}
            </p>
            <h2 className="display mt-4 text-4xl sm:text-5xl">{title}</h2>
          </div>
          {aside}
        </Reveal>
        {children}
      </div>
    </section>
  );
}
