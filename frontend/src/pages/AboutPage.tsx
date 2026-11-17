import { ArrowDown, ArrowRight } from 'lucide-react';
import { ModelExplorer } from '../components/ModelExplorer';
import { Reveal, stagger } from '../components/Reveal';
import { SectionNav } from '../components/SectionNav';
import { TeamCard } from '../components/about/TeamCard';
import { ButtonLink, PageHeader, SectionHeading } from '../components/ui';
import { ARCHITECTURE, EXPLAINABILITY, MODELS, PIPELINE, RESPONSIBLE_USE, TEAM } from '../data/project';
import { useDocumentTitle } from '../lib/hooks';

const SECTIONS = [
  { id: 'architecture', label: 'Architecture' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'models', label: 'Models' },
  { id: 'explainability', label: 'Explainability' },
  { id: 'team', label: 'Team' },
];

const chip =
  'inline-flex items-center rounded-full border border-signal/25 bg-signal/[0.06] px-3 py-1 font-mono text-xs leading-none text-bone/90';

export function AboutPage() {
  useDocumentTitle('About');

  return (
    <>
      <PageHeader
        index="04"
        label="About"
        aside={
          <img
            src="/brand/facex-logo.png"
            alt="Face-X Detection. Trust what you see. Verify what you can’t."
            width={1381}
            height={388}
            decoding="async"
            className="h-auto w-[360px] xl:w-[420px]"
          />
        }
        title={
          <>
            A forensic pipeline, <em className="text-signal">layer by layer.</em>
          </>
        }
      >
        Face-X Detection is an AI-based image authenticity and deepfake analysis system for still images. This page
        explains its architecture: how an image moves through the pipeline, what each model contributes, and how results
        are explained.
      </PageHeader>

      <SectionNav sections={SECTIONS} />

      {/* Architecture overview */}
      <section id="architecture" className="scroll-mt-28 md:scroll-mt-36 border-b hairline">
        <div className="shell py-20 sm:py-24">
          <SectionHeading eyebrow="System architecture" title="From browser to verdict.">
            Four layers, each with a single responsibility. The interface never computes or alters a result; it shows what
            the inference service returns.
          </SectionHeading>
          <ol className="mt-14 grid gap-5 lg:grid-cols-4">
            {ARCHITECTURE.map((a, i) => (
              <Reveal as="li" key={a.layer} delay={stagger(i, 100)} className="relative">
                <div className="panel h-full p-6">
                  <p className="eyebrow">
                    <span className="text-signal">0{i + 1}</span> · {a.layer}
                  </p>
                  <h3 className="display mt-5 text-3xl">{a.title}</h3>
                  <p className="mt-2 break-words font-mono text-[11px] leading-relaxed text-signal/80">{a.tech}</p>
                  <p className="mt-4 text-sm leading-relaxed text-mist">{a.body}</p>
                </div>
                {i < ARCHITECTURE.length - 1 && (
                  <span
                    aria-hidden
                    className="absolute -bottom-[24px] left-1/2 z-10 flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-full border border-white/10 bg-ink-950 text-signal lg:-right-[24px] lg:bottom-auto lg:left-auto lg:top-1/2 lg:-translate-y-1/2 lg:translate-x-0"
                  >
                    <ArrowDown className="h-3.5 w-3.5 lg:hidden" />
                    <ArrowRight className="hidden h-3.5 w-3.5 lg:block" />
                  </span>
                )}
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* Pipeline */}
      <section id="pipeline" className="scroll-mt-28 md:scroll-mt-36 border-b hairline">
        <div className="shell py-20 sm:py-24">
          <SectionHeading eyebrow="Detection pipeline" title="Nine stages, upload to report.">
            Each stage adds a different kind of evidence before the scores are fused and explained. The models that act at
            each stage are listed alongside it.
          </SectionHeading>

          {/* The spine draws down once the list is in view; each stage then reveals as it is reached. */}
          <Reveal variant="fade" className="relative mt-14">
            <span
              aria-hidden
              className="reveal-spine absolute inset-y-0 left-0 w-px bg-gradient-to-b from-signal/50 via-white/[0.12] to-white/[0.07]"
            />
            <ol aria-label="Pipeline stages">
              {PIPELINE.map((stage) => (
                <Reveal as="li" key={stage.id} className="relative grid gap-3 py-6 pl-8 sm:grid-cols-12 sm:gap-6 sm:pl-10">
                  <span
                    aria-hidden
                    className="reveal-dot absolute -left-[4.5px] top-8 h-2.5 w-2.5 rounded-full border border-signal/70 bg-ink-950"
                  />
                  <div className="sm:col-span-1">
                    <span className="font-mono text-sm text-signal">{stage.id}</span>
                  </div>
                  <div className="sm:col-span-4">
                    <h3 className="text-lg font-medium text-bone">{stage.title}</h3>
                    {stage.components && (
                      <ul aria-label="Components" className="mt-3 flex flex-wrap gap-2">
                        {stage.components.map((c) => (
                          <li key={c} className={chip}>
                            {c}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed text-mist sm:col-span-7">{stage.summary}</p>
                </Reveal>
              ))}
            </ol>
          </Reveal>
        </div>
      </section>

      {/* Models */}
      <section id="models" className="scroll-mt-28 md:scroll-mt-36 border-b hairline">
        <div className="shell py-20 sm:py-24">
          <SectionHeading eyebrow="Models & components" title={<>Ten components, <em className="text-mist">one verdict.</em></>}>
            Face-X is designed around complementary models, each targeting a different kind of evidence. Hover over or
            select a component to see how it works.
          </SectionHeading>
          <Reveal delay={120} className="mt-14">
            <ModelExplorer models={MODELS} initialId="swin" />
          </Reveal>
        </div>
      </section>

      {/* Explainability */}
      <section id="explainability" className="scroll-mt-28 md:scroll-mt-36 border-b hairline">
        <div className="shell grid gap-14 py-20 sm:py-24 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <SectionHeading eyebrow="Explainability" title="Explainable by design.">
              A verdict is only useful if you can see what it rests on. Results expose the evidence behind them rather than
              a bare label.
            </SectionHeading>
            <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border hairline bg-white/[0.07] sm:grid-cols-2">
              {EXPLAINABILITY.map((e, i) => (
                <div key={e.title} className="bg-ink-950">
                  <Reveal delay={stagger(i, 90)} className="h-full p-6">
                    <h3 className="font-medium text-bone">{e.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-mist">{e.body}</p>
                  </Reveal>
                </div>
              ))}
            </div>
          </div>
          <aside className="lg:col-span-4 lg:col-start-9 lg:pt-28">
            <Reveal delay={150} className="panel p-6 sm:p-7">
              <p className="eyebrow">Reading results responsibly</p>
              <ul className="mt-5 space-y-5">
                {RESPONSIBLE_USE.map(([title, body]) => (
                  <li key={title}>
                    <p className="text-sm font-medium text-bone">{title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-mist">{body}</p>
                  </li>
                ))}
              </ul>
            </Reveal>
          </aside>
        </div>
      </section>

      {/* Team */}
      <section id="team" className="scroll-mt-28 md:scroll-mt-36 border-b hairline">
        <div className="shell py-20 sm:py-24">
          <SectionHeading eyebrow="Team" title="The team behind Face-X." />
          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TEAM.map((member, i) => (
              <Reveal as="li" key={member.email} delay={stagger(i, 90)}>
                <TeamCard member={member} />
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* Acknowledgements */}
      <section>
        <div className="shell grid gap-10 py-20 sm:py-24 lg:grid-cols-12">
          <Reveal className="lg:col-span-7">
            <p className="eyebrow">Acknowledgements</p>
            <p className="mt-4 text-mist">
              Built on Swin Transformer V2 (Liu et al., CVPR 2022) via the <span className="text-bone">timm</span> library,
              with PyTorch, FastAPI, React and Tailwind CSS. The wider architecture draws on MTCNN, Spatial Rich Models,
              Face X-ray, Cross-ViT, Depth Anything V2, MediaPipe Face Mesh and Grad-CAM.
            </p>
          </Reveal>
          <Reveal delay={120} className="flex items-end lg:col-span-4 lg:col-start-9 lg:justify-end">
            <ButtonLink to="/detect" size="lg">
              Try the detector
              <ArrowRight aria-hidden className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </ButtonLink>
          </Reveal>
        </div>
      </section>
    </>
  );
}
