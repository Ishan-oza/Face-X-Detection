import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  Crop,
  Layers,
  Lock,
  RefreshCw,
  RotateCcw,
  ScanFace,
  Sparkles,
  Trash2,
  Upload,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { AnalysisProgress, type RunStage } from '../components/detect/AnalysisProgress';
import { ModeSwitch, type AnalysisMode } from '../components/detect/ModeSwitch';
import { PageDropOverlay, usePageFileInput } from '../components/detect/PageFileDrop';
import { Steps } from '../components/detect/Steps';
import { Dropzone } from '../components/Dropzone';
import { ModelSelector, isReady } from '../components/ModelSelector';
import { Alert, PageHeader, SpecimenFrame, buttonClasses, cx } from '../components/ui';
import { useAnalysis } from '../context/AnalysisContext';
import { useBackend } from '../context/BackendContext';
import { useDocumentTitle, useElapsedSeconds } from '../lib/hooks';
import { ACCEPT_ATTRIBUTE, formatBytes, validateImageFile } from '../lib/imageValidation';
import { usePageNavigate } from '../lib/navigation';
import { ApiError, analyzeImage, errorMessage } from '../services/api';
import type { ModelInfo } from '../services/apiTypes';

const TIPS = [
  { icon: ScanFace, text: 'Use a clear, front-facing face that fills most of the frame.' },
  {
    icon: Users,
    text: 'Images with several faces are analysed as one whole image. Crop to a single face for a focused result.',
  },
  { icon: Crop, text: 'Images are resized to 256 × 256, so a small face loses detail. Crop tightly where you can.' },
  { icon: Zap, text: 'Heavy compression, filters or screenshots can mislead the model.' },
  { icon: Lock, text: 'Your image is sent only to the Face-X analysis service and is not stored by this website.' },
];

/** How long the "complete" state is shown before moving to Results. */
const COMPLETE_HOLD_MS = 550;

type Run =
  | { status: 'idle' }
  | { status: 'running'; stage: RunStage; uploaded?: number }
  | { status: 'cancelled' }
  | { status: 'failed'; title: string; message: string; retry: boolean };

/** Turn an API failure into a clear title, message and whether retrying could help. */
function describeFailure(err: unknown): Extract<Run, { status: 'failed' }> {
  const message = errorMessage(err);
  if (!(err instanceof ApiError)) return { status: 'failed', title: 'Analysis failed', message, retry: true };
  switch (err.kind) {
    case 'network':
      return { status: 'failed', title: 'Can’t reach the analysis service', message, retry: true };
    case 'timeout':
      return { status: 'failed', title: 'The analysis timed out', message, retry: true };
    case 'invalid_response':
      return { status: 'failed', title: 'Unexpected response', message, retry: true };
    default:
      if (err.status === 503) return { status: 'failed', title: 'Model unavailable', message, retry: true };
      if (err.status && err.status < 500) return { status: 'failed', title: 'The image was rejected', message, retry: false };
      return { status: 'failed', title: 'The analysis failed on the server', message, retry: true };
  }
}

export function DetectPage() {
  useDocumentTitle('Detect');
  const navigate = usePageNavigate();
  const { selection, select, complete } = useAnalysis();
  const { connection, models, modelsError, refresh } = useBackend();

  const [validating, setValidating] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [run, setRun] = useState<Run>({ status: 'idle' });
  const [mode, setMode] = useState<AnalysisMode>('standard');
  const [modelId, setModelId] = useState<string | null>(null);
  const [useGemini, setUseGemini] = useState<boolean>(() => {
    return localStorage.getItem('facex_use_gemini') === 'true';
  });
  const [geminiApiKey, setGeminiApiKey] = useState<string>(() => {
    return localStorage.getItem('facex_gemini_api_key') || '';
  });

  const toggleGemini = (enabled: boolean) => {
    setUseGemini(enabled);
    localStorage.setItem('facex_use_gemini', String(enabled));
  };

  const handleApiKeyChange = (key: string) => {
    setGeminiApiKey(key);
    localStorage.setItem('facex_gemini_api_key', key);
  };

  const abortRef = useRef<AbortController | null>(null);
  // Synchronous guard: a second click before React re-renders must not start a second request.
  const inFlight = useRef(false);

  const running = run.status === 'running';
  const busy = running || validating;
  const serverSeconds = useElapsedSeconds(running && run.stage === 'processing');

  useEffect(() => () => abortRef.current?.abort(), []);

  const readyModels = useMemo(() => (models ?? []).filter(isReady), [models]);
  const defaultModel: ModelInfo | null = useMemo(
    () => (models ?? []).find((m) => m.is_default) ?? null,
    [models],
  );

  // Advanced mode: keep a valid, ready model selected as the registry changes.
  useEffect(() => {
    if (modelId && readyModels.some((m) => m.id === modelId)) return;
    setModelId((readyModels.find((m) => m.is_default) ?? readyModels[0])?.id ?? null);
  }, [readyModels, modelId]);

  const chosenModel = mode === 'advanced' ? (readyModels.find((m) => m.id === modelId) ?? null) : null;
  const modelLabel = mode === 'advanced' ? (chosenModel?.name ?? 'the selected model') : (defaultModel?.name ?? 'the default pipeline');

  const handleFile = async (file: File) => {
    if (inFlight.current) return;
    setFileError(null);
    setRun({ status: 'idle' });
    setValidating(true);
    const result = await validateImageFile(file);
    setValidating(false);
    if (result.ok) select(result.image);
    else setFileError(result.error);
  };

  const dragging = usePageFileInput((file) => void handleFile(file), !busy);

  const runAnalysis = async () => {
    if (!selection || inFlight.current) return;
    if (mode === 'advanced' && !chosenModel) return;
    inFlight.current = true;

    const controller = new AbortController();
    abortRef.current = controller;
    setRun({ status: 'running', stage: 'uploading', uploaded: 0 });
    const startedAt = performance.now();

    try {
      const result = await analyzeImage(selection.file, mode === 'advanced' ? chosenModel!.id : null, {
        signal: controller.signal,
        onProgress: (p) => setRun({ status: 'running', stage: p.stage, uploaded: p.uploaded }),
        useGemini,
        geminiApiKey: geminiApiKey.trim() || undefined,
      });
      const totalMs = performance.now() - startedAt;
      setRun({ status: 'running', stage: 'complete' });
      complete({
        ...result,
        image: selection,
        mode,
        modelId: result.response.model_id ?? chosenModel?.id ?? null,
        modelName: result.response.model_name ?? chosenModel?.name ?? defaultModel?.name ?? null,
        completedAt: new Date(),
        useGemini,
        timings: { totalMs },
      });
      // Brief, real completion state before the transition to Results.
      await new Promise((r) => setTimeout(r, COMPLETE_HOLD_MS));
      if (!controller.signal.aborted) navigate('/results');
    } catch (err) {
      if (err instanceof ApiError && err.kind === 'aborted') {
        setRun({ status: 'cancelled' });
      } else {
        setRun(describeFailure(err));
        if (err instanceof ApiError && (err.kind === 'network' || err.status === 503)) refresh();
      }
    } finally {
      inFlight.current = false;
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  const cancel = () => abortRef.current?.abort();

  const serviceDown = connection === 'offline';
  const blocker = !selection
    ? 'Add an image to begin.'
    : connection === 'checking'
      ? 'Connecting to the analysis service…'
      : serviceDown
        ? 'The analysis service is unavailable.'
        : mode === 'advanced' && !chosenModel
          ? 'No model is available to select.'
          : mode === 'standard' && defaultModel && !isReady(defaultModel)
            ? `${defaultModel.name} is not available right now.`
            : null;

  const stepIndex: 0 | 1 | 2 = running && run.stage === 'complete' ? 2 : selection ? 1 : 0;
  const imageStage = running ? run.stage : null;

  return (
    <>
      <PageDropOverlay visible={dragging} />

      <PageHeader
        compact
        index="02"
        label="Detect"
        title={
          <>
            Submit an image for <em className="text-signal">examination.</em>
          </>
        }
      >
        Drop, browse or paste a still image containing a face. It’s checked in your browser, then analysed by the Face-X
        detection service.
      </PageHeader>

      <div className="shell grid gap-8 py-8 sm:py-10 lg:grid-cols-12 lg:gap-12">
        {/* Left: upload / preview */}
        <section aria-label="Image" className="lg:col-span-7">
          {selection ? (
            <SpecimenFrame
              key={selection.previewUrl}
              className="animate-scale-in"
              active={running}
              topLeft={selection.file.name}
              topRight={`${selection.width} × ${selection.height} px`}
              bottomLeft={selection.mime.replace('image/', '').toUpperCase()}
              bottomRight={formatBytes(selection.file.size)}
            >
              <div
                className={cx(
                  'relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl bg-ink-900 transition-shadow duration-500 sm:aspect-[16/10] lg:aspect-auto lg:h-[clamp(260px,calc(100svh-31rem),470px)]',
                  imageStage === 'complete' && 'shadow-[inset_0_0_0_2px_rgba(198,243,107,0.7)]',
                  dragging && 'opacity-60',
                )}
              >
                <div aria-hidden className="bg-grid absolute inset-0 opacity-60" />
                <img
                  src={selection.previewUrl}
                  alt={`Preview of ${selection.file.name}`}
                  // Shared element: morphs into the Results page specimen image.
                  style={{ viewTransitionName: 'specimen-image' }}
                  className={cx(
                    'relative max-h-full max-w-full object-contain transition duration-700 ease-out-expo',
                    imageStage && imageStage !== 'complete' && 'scale-[0.985] saturate-[0.4]',
                  )}
                />
                {imageStage && (
                  <div className="absolute inset-0 animate-fade-up-fast" aria-hidden>
                    {imageStage !== 'complete' && (
                      <>
                        <div className="absolute inset-0 bg-ink-950/35" />
                        <div className="absolute inset-x-0 h-1/3 animate-scan bg-gradient-to-b from-transparent via-signal/20 to-transparent">
                          <div className="absolute inset-x-0 bottom-1/2 h-px bg-signal shadow-[0_0_12px_rgba(198,243,107,0.9)]" />
                        </div>
                      </>
                    )}
                    <div className="absolute inset-x-0 bottom-4 flex justify-center">
                      <span className="inline-flex items-center gap-2 rounded-full border border-signal/30 bg-ink-950/80 px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-signal backdrop-blur">
                        {imageStage === 'complete' ? (
                          <Check className="h-3.5 w-3.5 animate-scale-in" strokeWidth={3} />
                        ) : (
                          <span className="h-1.5 w-1.5 animate-blink rounded-full bg-signal" />
                        )}
                        {imageStage === 'uploading' &&
                          `Uploading${run.status === 'running' && run.uploaded !== undefined ? ` · ${Math.round(run.uploaded * 100)}%` : ''}`}
                        {imageStage === 'processing' && `Analysing · ${serverSeconds}s`}
                        {imageStage === 'receiving' && 'Receiving results'}
                        {imageStage === 'complete' && 'Analysis complete'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </SpecimenFrame>
          ) : (
            <Dropzone onFile={handleFile} disabled={busy} busy={validating} dragging={dragging} />
          )}

          {selection && (
            <div className="mt-4 flex animate-fade-up-fast flex-wrap gap-2">
              <label
                className={cx(
                  buttonClasses('secondary'),
                  'focus-within:ring-2 focus-within:ring-signal focus-within:ring-offset-2 focus-within:ring-offset-ink-950',
                  busy ? 'pointer-events-none opacity-40' : 'cursor-pointer',
                )}
              >
                <Upload aria-hidden className="h-4 w-4" />
                Replace image
                <input
                  type="file"
                  accept={ACCEPT_ATTRIBUTE}
                  className="sr-only"
                  disabled={busy}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleFile(f);
                    e.target.value = '';
                  }}
                />
              </label>
              <button
                type="button"
                className={buttonClasses('ghost')}
                disabled={busy}
                onClick={() => {
                  select(null);
                  setRun({ status: 'idle' });
                }}
              >
                <Trash2 aria-hidden className="h-4 w-4" />
                Remove
              </button>
            </div>
          )}

          <div className="mt-4 space-y-3" aria-live="polite">
            {fileError && <Alert title="This file can’t be used">{fileError}</Alert>}
            {selection && Math.min(selection.width, selection.height) < 256 && (
              <Alert tone="warning" title="Low resolution">
                The shorter side is under 256 px, so the image will be upscaled for the model. Results on small images
                may be less reliable.
              </Alert>
            )}
          </div>
        </section>

        {/* Right: analysis panel */}
        <aside aria-label="Analysis" className="space-y-5 lg:col-span-5">
          <section className="panel animate-fade-up p-5 sm:p-7 [animation-delay:80ms]">
            <Steps current={stepIndex} busy={running} />

            {/* Mode + model */}
            <div className="mt-7 border-t hairline pt-6">
              <h2 className="eyebrow">Analysis mode</h2>
              <div className="mt-3">
                <ModeSwitch value={mode} onChange={setMode} disabled={busy} />
              </div>

              <div className="mt-5">
                {!models && connection === 'checking' && (
                  <div className="flex animate-pulse items-center gap-4 rounded-xl border border-white/[0.06] p-4" aria-hidden>
                    <span className="h-10 w-10 rounded-lg bg-white/[0.06]" />
                    <span className="flex-1 space-y-2">
                      <span className="block h-3 w-1/2 rounded bg-white/[0.08]" />
                      <span className="block h-2.5 w-2/3 rounded bg-white/[0.05]" />
                    </span>
                  </div>
                )}

                {mode === 'standard' && models && (
                  <div key="standard" className="flex animate-fade-up-fast items-center gap-4 rounded-xl border border-white/[0.07] bg-ink-950/40 p-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-signal/25 bg-signal/10 text-signal">
                      <Layers aria-hidden className="h-5 w-5" strokeWidth={1.6} />
                    </span>
                    <span className="min-w-0">
                      <span className="eyebrow block !text-[10px]">Configured pipeline</span>
                      <span className="mt-1 block font-medium text-bone">{defaultModel?.name ?? 'Server default'}</span>
                      {defaultModel && (
                        <span className="mt-0.5 block truncate font-mono text-[11px] text-mist">
                          {defaultModel.architecture ?? defaultModel.id}
                          {defaultModel.input_size && ` · ${defaultModel.input_size[0]}×${defaultModel.input_size[1]}`}
                        </span>
                      )}
                    </span>
                  </div>
                )}

                {mode === 'advanced' && models && models.length > 0 && (
                  <div key="advanced" className="animate-fade-up-fast">
                    <p className="mb-3 text-xs text-mist">
                      {models.length === 1
                        ? 'One model is currently registered with the analysis service.'
                        : `${models.length} models are registered with the analysis service.`}
                    </p>
                    <ModelSelector models={models} value={modelId} onChange={setModelId} disabled={busy} />
                  </div>
                )}
              </div>
            </div>

            {/* Advanced Gemini Explanations */}
            <div className="mt-6 border-t hairline pt-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-signal/25 bg-signal/10 text-signal">
                    <Sparkles aria-hidden className="h-4 w-4" />
                  </span>
                  <div>
                    <label htmlFor="gemini-toggle" className="cursor-pointer text-sm font-medium text-bone">
                      Advanced Gemini Explanations
                    </label>
                    <p className="text-xs text-mist">
                      Optional natural-language forensic reasoning
                    </p>
                  </div>
                </div>
                <button
                  id="gemini-toggle"
                  type="button"
                  role="switch"
                  aria-checked={useGemini}
                  disabled={busy}
                  onClick={() => toggleGemini(!useGemini)}
                  className={cx(
                    'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-signal focus:ring-offset-2 focus:ring-offset-ink-950',
                    useGemini ? 'bg-signal' : 'bg-white/20',
                    busy && 'pointer-events-none opacity-40',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cx(
                      'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-ink-950 shadow-md ring-0 transition duration-200 ease-in-out',
                      useGemini ? 'translate-x-5' : 'translate-x-0',
                    )}
                  />
                </button>
              </div>

              {useGemini && (
                <div className="mt-3.5 animate-fade-up-fast rounded-xl border border-white/[0.08] bg-ink-950/40 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="gemini-key-input" className="block font-mono text-[11px] uppercase tracking-wider text-mist">
                      Gemini API Key
                    </label>
                    <span className="font-mono text-[10px] text-signal/80">Optional if set on server</span>
                  </div>
                  <input
                    id="gemini-key-input"
                    type="password"
                    value={geminiApiKey}
                    onChange={(e) => handleApiKeyChange(e.target.value)}
                    placeholder="AIzaSy... (leave blank to use server environment)"
                    disabled={busy}
                    className="w-full rounded-lg border border-white/10 bg-ink-900 px-3 py-1.5 font-mono text-xs text-bone placeholder:text-mist/40 focus:border-signal focus:outline-none focus:ring-1 focus:ring-signal"
                  />
                </div>
              )}
            </div>

            {/* Problems are shown only when they block analysis. */}
            {serviceDown && (
              <div className="mt-5">
                <Alert
                  title="Analysis service unavailable"
                  action={
                    <button type="button" onClick={refresh} className={buttonClasses('secondary')}>
                      <RefreshCw aria-hidden className="h-4 w-4" /> Try again
                    </button>
                  }
                >
                  The Face-X analysis service couldn’t be reached. Make sure it is running, then try again.
                </Alert>
              </div>
            )}
            {!serviceDown && connection === 'online' && !models && modelsError && (
              <div className="mt-5">
                <Alert tone="warning" title="Model list unavailable">
                  {modelsError} Standard analysis can still be attempted.
                </Alert>
              </div>
            )}

            {/* Action / progress */}
            <div className="mt-6" aria-live="polite">
              {running ? (
                <div className="animate-fade-up-fast">
                  <AnalysisProgress
                    stage={run.stage}
                    uploaded={run.uploaded}
                    serverSeconds={serverSeconds}
                    modelLabel={modelLabel}
                  />
                  {run.stage !== 'complete' ? (
                    <button type="button" onClick={cancel} className={cx(buttonClasses('secondary'), 'mt-4 w-full')}>
                      <X aria-hidden className="h-4 w-4" /> Cancel analysis
                    </button>
                  ) : (
                    <p className="mt-4 flex items-center justify-center gap-2 text-sm text-signal">
                      <Check aria-hidden className="h-4 w-4" /> Analysis complete. Opening results…
                    </p>
                  )}
                </div>
              ) : (
                <>
                  {run.status === 'failed' && (
                    <div className="mb-4">
                      <Alert
                        title={run.title}
                        action={
                          run.retry && selection ? (
                            <button type="button" onClick={runAnalysis} className={buttonClasses('secondary')}>
                              <RotateCcw aria-hidden className="h-4 w-4" /> Retry
                            </button>
                          ) : undefined
                        }
                      >
                        {run.message}
                      </Alert>
                    </div>
                  )}
                  {run.status === 'cancelled' && (
                    <div className="mb-4">
                      <Alert tone="info" title="Analysis cancelled">
                        Your image is still loaded. Run the analysis again whenever you’re ready.
                      </Alert>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={runAnalysis}
                    disabled={!!blocker || busy}
                    className={cx(buttonClasses('primary', 'lg'), 'w-full')}
                  >
                    {mode === 'advanced' && chosenModel ? `Analyse with ${chosenModel.name}` : 'Run analysis'}
                    <ArrowRight aria-hidden className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </button>
                  <p className="mt-3 min-h-5 text-center text-sm text-mist">
                    {blocker ?? 'Ready. Results usually take a moment.'}
                  </p>
                </>
              )}
            </div>
          </section>

          <section className="animate-fade-up rounded-2xl border border-dashed border-white/10 p-5 [animation-delay:160ms] sm:p-7">
            <h2 className="eyebrow">For reliable results</h2>
            <ul className="mt-4 space-y-3.5">
              {TIPS.map(({ icon: Icon, text }) => (
                <li key={text} className="flex gap-3 text-sm leading-relaxed text-mist">
                  <Icon aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-signal/80" strokeWidth={1.6} />
                  {text}
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </>
  );
}
