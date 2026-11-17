import { useMemo } from 'react';
import { ArrowRight, ChevronDown, FileQuestion, Info, RotateCcw, Sparkles } from 'lucide-react';
import { ExportActions } from '../components/results/ExportActions';
import { ImageViewer } from '../components/results/ImageViewer';
import { FactGrid, ModelOutputs, PipelineTimeline, ReportSection } from '../components/results/ReportSections';
import { ScoreBalance, ScoreRing } from '../components/results/ScoreCharts';
import { toneFor, toneText } from '../components/results/shared';
import { Reveal } from '../components/Reveal';
import { SectionNav } from '../components/SectionNav';
import { Alert, Badge, ButtonLink, PageHeader, SpecimenFrame, buttonClasses, cx } from '../components/ui';
import { useAnalysis } from '../context/AnalysisContext';
import { useBackend } from '../context/BackendContext';
import { useDocumentTitle } from '../lib/hooks';
import { usePageNavigate } from '../lib/navigation';
import { buildReport } from '../lib/report/buildReport';

function EmptyState() {
  return (
    <>
      <PageHeader compact index="03" label="Results" title={<>No case file <em className="text-mist">yet.</em></>}>
        Results appear here after you run an analysis. They are kept only in this browser tab and disappear on refresh.
      </PageHeader>
      <div className="shell grid items-center gap-10 py-10 sm:py-12 short:items-start short:py-6 lg:grid-cols-12 lg:gap-16">
        <SpecimenFrame
          className="animate-scale-in lg:col-span-5"
          topLeft="Specimen"
          topRight="— × —"
          bottomLeft="Awaiting image"
          bottomRight="—"
        >
          <div className="relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed border-white/10 bg-ink-900/60">
            <div aria-hidden className="bg-grid mask-radial absolute inset-0" />
            <FileQuestion aria-hidden className="relative h-10 w-10 text-mist" strokeWidth={1.2} />
            <p className="relative mt-4 font-mono text-[11px] uppercase tracking-[0.16em] text-mist">No analysis yet</p>
          </div>
        </SpecimenFrame>
        <div className="animate-fade-up [animation-delay:120ms] lg:col-span-6 lg:col-start-7">
          <h2 className="display text-4xl sm:text-5xl">Run an analysis to open a case file.</h2>
          <ol className="mt-8 space-y-4 short:mt-5">
            {[
              'Upload a JPG, PNG or WebP image on the Detect page.',
              'Run the analysis with the configured pipeline or a model you choose.',
              'Review the verdict, model scores, pipeline and technical details here, and export them as PDF or JSON.',
            ].map((step, i) => (
              <li key={step} className="flex gap-4 text-mist">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/15 font-mono text-[11px] text-bone">
                  {i + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
          <div className="mt-10 flex flex-wrap gap-3 short:mt-6">
            <ButtonLink to="/detect" size="lg">
              Analyse an image
              <ArrowRight aria-hidden className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </ButtonLink>
            <ButtonLink to="/about" size="lg" variant="secondary">
              How it works
            </ButtonLink>
          </div>
        </div>
      </div>
    </>
  );
}

export function ResultsPage() {
  useDocumentTitle('Results');
  const navigate = usePageNavigate();
  const { analysis, reset } = useAnalysis();
  const { models } = useBackend();
  const report = useMemo(() => (analysis ? buildReport(analysis, models) : null), [analysis, models]);

  const sections = useMemo(() => {
    const s = [{ id: 'verdict', label: 'Verdict' }];
    if (report?.narrative) s.push({ id: 'narrative', label: 'Narrative' });
    if (report?.evidence?.length) s.push({ id: 'evidence', label: 'Evidence' });
    if (report?.visualizations && Object.keys(report.visualizations).length > 0) {
      s.push({ id: 'visualizations', label: 'Visual maps' });
    }
    s.push(
      { id: 'models', label: 'Model outputs' },
      { id: 'pipeline', label: 'Pipeline' },
      { id: 'details', label: 'Technical details' },
      { id: 'limitations', label: 'Limitations' },
    );
    return s;
  }, [report]);

  if (!analysis || !report) return <EmptyState />;

  const tone = toneFor(report.verdict.label);
  const model = report.models[0];

  const analyseAnother = () => {
    reset();
    navigate('/detect');
  };

  return (
    <>
      {/* Report header */}
      <header className="relative overflow-hidden border-b hairline">
        <div aria-hidden className="bg-grid mask-fade-b absolute inset-0" />
        <div
          aria-hidden
          className={cx(
            'absolute -right-32 -top-32 h-96 w-96 rounded-full opacity-[0.08] blur-[110px]',
            tone === 'fake' ? 'bg-fake' : tone === 'real' ? 'bg-real' : 'bg-signal',
          )}
        />
        <div className="shell relative flex flex-col gap-8 pb-8 pt-9 sm:pt-11 short:pb-6 short:pt-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="eyebrow animate-fade-up">
              <span className="text-signal">03</span> <span className="mx-2 text-ink-500">/</span> Analysis report
            </p>
            <h1 className="display mt-4 animate-fade-up text-[38px] [animation-delay:80ms] sm:text-5xl lg:text-[56px] short:text-5xl">
              Case file <em className="text-mist">·</em> <span className={toneText[tone]}>{report.verdict.label}</span>
            </h1>
            <ul className="mt-4 flex short:mt-3 animate-fade-up flex-wrap gap-2 [animation-delay:160ms]">
              {[
                report.id,
                report.createdAt.toLocaleString(),
                report.verdict.rawVerdict ? `Verdict: ${report.verdict.rawVerdict}` : (report.mode === 'advanced' ? 'Advanced mode' : 'Standard mode'),
                report.image.name,
              ].map((chip) => (
                <li key={chip} className="max-w-full truncate rounded-full border border-white/10 px-3 py-1 font-mono text-[11px] text-mist">
                  {chip}
                </li>
              ))}
            </ul>
          </div>
          <div className="animate-fade-up [animation-delay:220ms]">
            <ExportActions report={report} analysis={analysis} />
          </div>
        </div>
      </header>

      <SectionNav sections={sections} />

      {/* Verdict */}
      <section id="verdict" className="scroll-mt-28 md:scroll-mt-36 border-b hairline">
        <div className="shell grid gap-8 py-8 sm:py-10 short:py-5 lg:grid-cols-12 lg:gap-10">
          <div className="animate-scale-in [animation-delay:60ms] lg:col-span-5">
            <ImageViewer
              src={report.image.previewUrl}
              name={report.image.name}
              width={report.image.width}
              height={report.image.height}
              inputSize={model.inputSize}
              overlay={report.overlay}
              caption={report.verdict.source}
              visualizations={report.visualizations}
            />
          </div>

          <div className="space-y-5 lg:col-span-7">
            <section aria-label="Verdict" className="panel relative animate-fade-up overflow-hidden p-6 [animation-delay:120ms] sm:p-8 short:p-6">
              <div
                aria-hidden
                className={cx(
                  'absolute -right-24 -top-24 h-64 w-64 rounded-full opacity-[0.12] blur-[80px]',
                  tone === 'fake' ? 'bg-fake' : tone === 'real' ? 'bg-real' : 'bg-signal',
                )}
              />
              <div className="relative flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="eyebrow">Final verdict</p>
                    {report.verdict.rawVerdict && (
                      <Badge tone={tone}>
                        {report.verdict.rawVerdict}
                      </Badge>
                    )}
                  </div>
                  <p className={cx('display mt-3 text-7xl uppercase sm:text-8xl short:mt-2 short:text-7xl', toneText[tone])}>
                    <span className="-my-[0.1em] block overflow-hidden py-[0.1em]">
                      <span className="block animate-line-up [animation-delay:220ms]">{report.verdict.label}</span>
                    </span>
                  </p>
                  <div className="mt-4 max-w-sm text-sm text-mist short:mt-3">
                    {report.verdict.manipulationProbability !== undefined && (
                      <span className="block font-mono text-sm text-bone mb-1 font-semibold">
                        {(report.verdict.manipulationProbability * 100).toFixed(1)}% manipulation probability
                      </span>
                    )}
                    <p>
                      {tone === 'fake' && 'The multi-stream pipeline scores this image as synthetic or manipulated.'}
                      {tone === 'real' && 'The multi-stream pipeline scores this image as an authentic capture.'}
                      {tone === 'signal' && 'Forensic verdict returned by the analysis service.'}
                    </p>
                    <span className="mt-1 block text-xs">From {report.verdict.source}.</span>
                  </div>
                </div>
                <ScoreRing value={report.verdict.score} tone={tone} />
              </div>

              <div className="relative mt-8 border-t hairline pt-7 short:mt-6 short:pt-5">
                <ScoreBalance scores={Object.entries(analysis.response.probabilities).map(([label, value]) => ({ label, value }))} />
              </div>

              <div className="relative mt-7 flex gap-3 rounded-xl border border-white/[0.07] bg-ink-950/40 p-4 text-sm">
                <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-signal" />
                <p className="text-mist">
                  <span className="text-bone">Calibrated multi-stream forensic fusion.</span> The late fusion layer weights
                  spectral high-pass noise, dual-patch attention, 3D geometric landmarks, and spatial disparity across 9 streams.
                </p>
              </div>
            </section>

            {report.warnings.length > 0 && (
              <Alert tone="warning" title="Notes from the analysis service">
                <ul className="list-disc space-y-1 pl-4">
                  {report.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </Alert>
            )}

            <div className="flex animate-fade-up flex-wrap gap-2 [animation-delay:200ms]">
              <button type="button" onClick={analyseAnother} className={buttonClasses('secondary')}>
                <RotateCcw aria-hidden className="h-4 w-4" /> Analyse another image
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Forensic Narrative */}
      {report.narrative && (
        <ReportSection id="narrative" eyebrow="Forensic narrative" title="Plain-English explanation.">
          <div className="grid gap-6 lg:grid-cols-12">
            <Reveal className="panel p-6 sm:p-8 lg:col-span-7 space-y-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-signal/25 bg-signal/10 text-signal">
                  <Sparkles className="h-4 w-4" />
                </span>
                <h3 className="font-medium text-bone">Forensic Assessment</h3>
              </div>
              {report.narrative.plain_english_explanation && (
                <p className="text-sm leading-relaxed text-bone/90 sm:text-base">
                  {report.narrative.plain_english_explanation}
                </p>
              )}
              {report.narrative.summary && (
                <div className="rounded-xl border border-white/[0.08] bg-ink-950/60 p-4 font-mono text-xs leading-relaxed text-mist">
                  <span className="text-signal uppercase tracking-wider block font-semibold mb-1">Executive Summary</span>
                  {report.narrative.summary}
                </div>
              )}
            </Reveal>

            <Reveal delay={80} className="panel p-6 sm:p-8 lg:col-span-5 space-y-4">
              <h3 className="font-medium text-bone">Key Observations</h3>
              {report.narrative.visual_observations && report.narrative.visual_observations.length > 0 ? (
                <ul className="space-y-3 text-xs leading-relaxed text-mist">
                  {report.narrative.visual_observations.map((obs, idx) => (
                    <li key={idx} className="flex gap-2.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-signal shrink-0 mt-1.5" />
                      <span>{obs}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-mist">No specific visual anomalies highlighted by the engine.</p>
              )}
            </Reveal>
          </div>
        </ReportSection>
      )}

      {/* Forensic Evidence Signals */}
      {report.evidence && report.evidence.length > 0 && (
        <ReportSection id="evidence" eyebrow="Forensic evidence" title="Multi-stream signal breakdown.">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {report.evidence.map((ev, i) => {
              const isSuspicious = ev.score > 0.45;
              return (
                <Reveal key={ev.key ?? i} delay={i * 40} className="panel p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <Badge tone={ev.stream === 'global' ? 'signal' : 'neutral'}>
                        {ev.stream.toUpperCase()} STREAM
                      </Badge>
                      <span className={cx('font-mono text-xs font-semibold', isSuspicious ? 'text-fake' : 'text-real')}>
                        Score {(ev.score * 100).toFixed(1)}%
                      </span>
                    </div>
                    <h4 className="font-medium text-bone text-sm">{ev.name}</h4>
                    {ev.note && (
                      <p className="mt-2 text-xs font-mono text-mist break-words">
                        {ev.note}
                      </p>
                    )}
                  </div>
                  <div className="mt-4 pt-3 border-t hairline">
                    <div className="h-1.5 w-full rounded-full bg-white/[0.08] overflow-hidden">
                      <div
                        className={cx(
                          'h-full rounded-full transition-all duration-500',
                          isSuspicious ? 'bg-fake' : 'bg-real',
                        )}
                        style={{ width: `${Math.min(100, Math.max(0, ev.score * 100))}%` }}
                      />
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </ReportSection>
      )}

      {/* Visual Evidence / Maps */}
      {report.visualizations && Object.keys(report.visualizations).length > 0 && (
        <ReportSection id="visualizations" eyebrow="Visual evidence" title="Generated forensic maps & overlays.">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Object.entries(report.visualizations).map(([key, url], idx) => {
              const labelMap: Record<string, string> = {
                swin_gar: 'Swin V2 Scene GAR Heatmap',
                crossvit_gar: 'CrossViT Dual-Scale Face Heatmap',
                mesh_gar_overlay: 'FaceMesh + Attention Overlay',
                face_mesh: 'FaceMesh 478 Landmarks',
                depth_map: 'Depth Anything V2 Map',
                srm_residual: 'SRM High-Pass Residuals',
                fft_spectrum: 'FFT Frequency Spectrum',
                xray_map: 'Face X-ray Boundary Seams',
                pose: 'MediaPipe Macro-Anatomy Pose',
                face_crop: 'Normalized Face Crop',
              };
              const title = labelMap[key] ?? key;
              return (
                <Reveal key={key} delay={idx * 30} className="panel overflow-hidden p-3 group">
                  <div className="relative aspect-square w-full rounded-lg overflow-hidden bg-ink-900 flex items-center justify-center">
                    <img
                      src={url}
                      alt={title}
                      loading="lazy"
                      className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                  <div className="p-2">
                    <h4 className="font-mono text-xs font-semibold text-bone truncate">{title}</h4>
                    <p className="font-mono text-[10px] text-mist truncate mt-0.5">{key}.png</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </ReportSection>
      )}

      <ReportSection id="models" eyebrow="Model outputs" title="What each stream returned.">
        <ModelOutputs models={report.models} verdictSource={report.verdict.source} />
      </ReportSection>

      <ReportSection id="pipeline" eyebrow="Analysis pipeline" title="How this result was produced.">
        <PipelineTimeline stages={report.pipeline} />
      </ReportSection>

      <ReportSection id="details" eyebrow="Technical details" title="The full record.">
        <Reveal className="panel p-6 sm:p-8">
          <FactGrid facts={report.technical} />
        </Reveal>
        <Reveal delay={80}>
          <details className="group panel mt-5 overflow-hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 transition-colors hover:bg-white/[0.02] sm:p-6 [&::-webkit-details-marker]:hidden">
              <span className="font-medium text-bone">Raw API response</span>
              <ChevronDown aria-hidden className="h-4 w-4 text-mist transition-transform duration-300 ease-out-expo group-open:rotate-180" />
            </summary>
            <div className="animate-fade-up-fast border-t hairline p-5 sm:p-6">
              <pre className="max-h-96 overflow-auto rounded-lg bg-ink-950 p-4 font-mono text-xs leading-relaxed text-bone/90">
                {JSON.stringify(report.raw, (k, v) => (k === 'heatmap' && typeof v === 'string' && v.length > 200 ? `<${v.length} chars>` : v), 2)}
              </pre>
            </div>
          </details>
        </Reveal>
      </ReportSection>

      <ReportSection id="limitations" eyebrow="Limitations" title="Read this result with care.">
        <ul className="grid gap-px overflow-hidden rounded-2xl border hairline bg-white/[0.07] md:grid-cols-2">
          {report.limitations.map((l, i) => (
            <li key={l} className="bg-ink-950">
              <Reveal delay={Math.min(i * 70, 280)} className="flex h-full gap-4 p-6">
                <span className="font-mono text-[11px] text-signal">{String(i + 1).padStart(2, '0')}</span>
                <p className="text-sm leading-relaxed text-mist">{l}</p>
              </Reveal>
            </li>
          ))}
        </ul>
      </ReportSection>

      {/* Closing actions */}
      <section>
        <div className="shell flex flex-col gap-6 py-16 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="eyebrow">Report {report.id}</p>
            <p className="display mt-2 text-3xl">Keep a copy, or examine another image.</p>
          </div>
          <div className="flex flex-col gap-3 sm:items-end">
            <ExportActions report={report} analysis={analysis} compact />
            <button type="button" onClick={analyseAnother} className={cx(buttonClasses('ghost'), 'self-start sm:self-end')}>
              <RotateCcw aria-hidden className="h-4 w-4" /> Analyse another image
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
