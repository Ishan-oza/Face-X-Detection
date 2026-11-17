import { ArrowRight, Binary, Eye, FileSearch, Layers, ScanFace, ShieldCheck, Upload, Waves } from 'lucide-react';
import { PipelineFlow } from '../components/home/PipelineFlow';
import { ReviewsSection } from '../components/home/Reviews';
import { Reveal, stagger } from '../components/Reveal';
import { ButtonLink, SectionHeading } from '../components/ui';
import { WindowAttentionVisual } from '../components/WindowAttentionVisual';
import { STACK } from '../data/project';
import { useDocumentTitle } from '../lib/hooks';

const CAPABILITIES: Array<{ icon: typeof Layers; title: string; body: string; models: string }> = [
  {
    icon: Layers,
    title: 'Transformer classification',
    body: 'Vision transformers weigh fine skin, eye and hair texture against global facial structure to classify an image as Real or Fake.',
    models: 'Swin Transformer V2 · Cross-ViT',
  },
  {
    icon: Waves,
    title: 'Forensic signal analysis',
    body: 'Noise residuals, blending seams and scene-level artefacts reveal the traces that generators and face-swaps leave behind.',
    models: 'SRM · Face X-ray · GAR',
  },
  {
    icon: ScanFace,
    title: 'Face geometry',
    body: 'Face alignment, monocular depth and a dense 3D mesh test whether a face is physically and geometrically plausible.',
    models: 'MTCNN · Depth Anything V2 · Face Mesh',
  },
  {
    icon: ShieldCheck,
    title: 'Fusion & explainability',
    body: 'Late fusion combines every branch into one verdict, and attention heatmaps show the regions that verdict rests on.',
    models: 'Late fusion · Grad-CAM',
  },
];

const STEPS = [
  { icon: Upload, title: 'Upload', body: 'Drop a JPEG, PNG or WebP up to 10 MB. It is checked in your browser before it leaves.' },
  { icon: Binary, title: 'Analyse', body: 'The FastAPI server resizes it to 256 × 256 and runs the selected model on GPU or CPU.' },
  { icon: FileSearch, title: 'Inspect', body: 'Read the verdict, class probabilities, latency and the raw API response — nothing hidden.' },
];

export function HomePage() {
  useDocumentTitle('');

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b hairline">
        <div aria-hidden className="bg-grid mask-fade-b absolute inset-0" />
        <div
          aria-hidden
          className="absolute -right-40 -top-40 h-[620px] w-[620px] animate-drift rounded-full bg-signal/[0.07] blur-[120px] will-change-transform"
        />
        <div className="shell relative grid items-center gap-14 pb-20 pt-14 sm:pt-20 lg:grid-cols-12 lg:gap-10 lg:pb-28 lg:pt-24">
          <div className="lg:col-span-7">
            <p className="eyebrow animate-fade-up">
              <span className="text-signal">●</span>&nbsp; Image authenticity · Deepfake analysis
            </p>
            {/* Each line rises out of its own mask; padding (cancelled by negative margin) keeps ascenders, descenders and italics unclipped. */}
            <h1 className="display mt-6 text-[56px] sm:text-[84px] xl:text-[104px]">
              <span className="-my-[0.12em] block overflow-hidden py-[0.12em] pr-[0.08em]">
                <span className="block animate-line-up [animation-delay:60ms]">Every synthetic face</span>
              </span>
              <span className="-my-[0.12em] block overflow-hidden py-[0.12em] pr-[0.08em]">
                <span className="block animate-line-up [animation-delay:170ms]">
                  may leave <em className="text-signal">a trace.</em>
                </span>
              </span>
            </h1>
            <p className="mt-7 max-w-xl animate-fade-up text-lg text-mist [animation-delay:300ms]">
              Face-X Detection is an AI-based image authenticity and deepfake analysis system. It looks for the
              fingerprints that GANs, diffusion models and face-swaps leave in still images, and explains what its verdict
              rests on.
            </p>
            <div className="mt-10 flex animate-fade-up flex-wrap gap-3 [animation-delay:380ms]">
              <ButtonLink to="/detect" size="lg">
                Analyse an image
                <ArrowRight aria-hidden className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </ButtonLink>
              <ButtonLink to="/about" size="lg" variant="secondary">
                How the pipeline works
              </ButtonLink>
            </div>
            <dl className="mt-14 grid max-w-xl animate-fade-up grid-cols-3 gap-6 border-t hairline pt-6 [animation-delay:460ms]">
              {[
                ['Formats', 'JPEG · PNG · WebP'],
                ['Max size', '10 MB'],
                ['Input', '256 × 256'],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="eyebrow">{k}</dt>
                  <dd className="mt-2 text-sm text-bone sm:text-base">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="mx-auto w-full max-w-md animate-scale-in [animation-delay:250ms] [animation-duration:1s] lg:col-span-5 lg:max-w-none">
            <WindowAttentionVisual />
          </div>
        </div>
      </section>

      {/* Threat landscape */}
      <section className="border-b hairline">
        <div className="shell grid gap-12 py-20 sm:py-28 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <SectionHeading
              eyebrow="The problem"
              title={
                <>
                  Photorealism is now <em className="text-mist">a commodity.</em>
                </>
              }
            />
          </div>
          <Reveal delay={120} className="space-y-6 text-mist lg:col-span-6 lg:col-start-7 lg:pt-10">
            <p className="text-lg text-bone/90">
              StyleGAN, Stable Diffusion, Midjourney, Flux and one-click face-swap tools can produce faces that pass a
              casual glance — enabling impersonation, fraud and disinformation.
            </p>
            <p>
              Classic CNN detectors often latch onto the fingerprint of a single generator and fail on unseen ones or on
              re-compressed images. Face-X is designed as a multi-branch system: transformer classifiers are combined
              with frequency, boundary and geometric evidence, so no single fingerprint decides the outcome.
            </p>
            <div className="flex items-start gap-3 rounded-xl border border-white/[0.07] bg-ink-900 p-4 text-sm">
              <Eye aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-signal" />
              <p>
                Scope is deliberately narrow: <span className="text-bone">still images only</span>. Video, audio and
                temporal analysis are outside its scope.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Capabilities */}
      <section className="border-b hairline">
        <div className="shell py-20 sm:py-28">
          <SectionHeading eyebrow="Architecture" title="Four kinds of evidence.">
            Each analysis branch looks for a different kind of trace. A fusion layer combines them into one verdict, and
            explainability shows where the evidence lies.
          </SectionHeading>
          <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border hairline bg-white/[0.07] sm:grid-cols-2 lg:grid-cols-4">
            {/* The hairline grid stays put; only each cell's content staggers in. */}
            {CAPABILITIES.map(({ icon: Icon, title, body, models }, i) => (
              <article key={title} className="group bg-ink-950 transition-colors duration-300 hover:bg-ink-900">
                <Reveal delay={stagger(i, 90)} className="flex h-full flex-col p-7">
                  <div className="flex items-center justify-between">
                    <Icon
                      aria-hidden
                      className="h-6 w-6 text-bone transition-colors duration-300 group-hover:text-signal"
                      strokeWidth={1.4}
                    />
                    <span className="font-mono text-[11px] text-mist">0{i + 1}</span>
                  </div>
                  <h3 className="mt-10 text-lg font-medium text-bone">{title}</h3>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-mist">{body}</p>
                  <p className="mt-6 border-t hairline pt-4 font-mono text-[11px] leading-relaxed text-signal/80">{models}</p>
                </Reveal>
              </article>
            ))}
          </div>
          <Reveal variant="fade" delay={200} className="mt-8">
            <ButtonLink to="/about#models" variant="ghost" className="!px-0">
              Explore every model
              <ArrowRight aria-hidden className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </ButtonLink>
          </Reveal>
        </div>
      </section>

      {/* How Face-X works */}
      <section className="border-b hairline">
        <div className="shell py-20 sm:py-28">
          <SectionHeading eyebrow="How Face-X works" title="From upload to verdict.">
            Five stages take an image from your browser to a prediction. Each one shows what the current pipeline does,
            and where the wider architecture adds more.
          </SectionHeading>
          <div className="mt-14">
            <PipelineFlow />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-b hairline">
        <div className="shell py-20 sm:py-28">
          <SectionHeading eyebrow="Workflow" title="Three steps. No account required." />
          <ol className="mt-14 grid gap-6 md:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, body }, i) => (
              <Reveal as="li" key={title} delay={stagger(i, 110)} className="relative">
                <div className="panel card-hover group relative h-full p-7">
                  <div className="flex items-center justify-between">
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-ink-950/50 text-bone transition-colors duration-300 group-hover:border-signal/40 group-hover:text-signal">
                      <Icon aria-hidden className="h-6 w-6" strokeWidth={1.4} />
                    </span>
                    <span className="font-mono text-[11px] text-signal">0{i + 1}</span>
                  </div>
                  <h3 className="display mt-8 text-3xl">{title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-mist">{body}</p>
                </div>
                {i < STEPS.length - 1 && (
                  <span
                    aria-hidden
                    className="absolute -right-[26px] top-1/2 z-10 hidden h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-ink-950 text-signal md:flex"
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                )}
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <ReviewsSection />

      {/* Stack + CTA */}
      <section>
        <div className="shell py-20 sm:py-28">
          <Reveal
            variant="scale"
            className="relative overflow-hidden rounded-3xl border hairline bg-ink-900 px-6 py-14 sm:px-14 sm:py-20"
          >
            <div aria-hidden className="bg-grid mask-radial absolute inset-0" />
            <div aria-hidden className="absolute -bottom-32 left-1/2 h-64 w-[640px] -translate-x-1/2 rounded-full bg-signal/10 blur-[100px]" />
            <div className="relative flex flex-col items-start gap-10 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <img
                  src="/brand/facex-logo.png"
                  alt="Face-X Detection. Trust what you see. Verify what you can’t."
                  width={1381}
                  height={388}
                  loading="lazy"
                  decoding="async"
                  className="mb-10 h-auto w-64 sm:w-80"
                />
                <p className="eyebrow">Ready when you are</p>
                <h2 className="display mt-4 max-w-2xl text-5xl sm:text-6xl">
                  Put an image under <em className="text-signal">the lens.</em>
                </h2>
                <ul aria-label="Technology stack" className="mt-8 flex flex-wrap gap-2">
                  {STACK.map((t) => (
                    <li key={t} className="rounded-full border border-white/10 px-3 py-1 font-mono text-[11px] text-mist">
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
              <ButtonLink to="/detect" size="lg" className="shrink-0">
                Start detection
                <ArrowRight aria-hidden className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </ButtonLink>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
