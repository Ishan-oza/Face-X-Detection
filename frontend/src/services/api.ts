import type {
  AnalyzeResponse,
  HealthResponse,
  ModelInfo,
  ModelsResponse,
  VeriStreamEvidenceItem,
  VeriStreamNarrative,
  VeriStreamReport,
} from './apiTypes';

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

export const ENDPOINTS = {
  health: '/api/health',
  models: '/api/models',
  analyze: '/api/analyze',
} as const;

export const apiUrl = (path: string) => `${API_BASE}${path}`;

export function resolveMediaUrl(path?: string | null): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:') || path.startsWith('blob:')) {
    return path;
  }
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${cleanPath}`;
}

export type ApiErrorKind = 'network' | 'timeout' | 'aborted' | 'http' | 'invalid_response';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;

  constructor(message: string, kind: ApiErrorKind, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
  }
}

/* ------------------------------------------------------------------ */
/* Runtime validation — the UI never renders a field it hasn't checked */
/* ------------------------------------------------------------------ */

type Json = Record<string, unknown>;

const isRecord = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const optString = (v: unknown) => (typeof v === 'string' && v.length > 0 ? v : undefined);
const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

const invalid = (what: string) =>
  new ApiError(`The backend returned an unexpected response (${what}).`, 'invalid_response');

const optSize = (v: unknown): [number, number] | undefined =>
  Array.isArray(v) && v.length === 2 && v.every(isFiniteNumber) ? [v[0], v[1]] : undefined;

export function parseHealth(data: unknown): HealthResponse {
  if (!isRecord(data) || typeof data.status !== 'string') throw invalid('health: missing "status"');
  return {
    status: data.status,
    service: optString(data.service),
    device: optString(data.device),
    gpu_name: optString(data.gpu_name),
    models_ready:
      isFiniteNumber(data.models_ready) || typeof data.models_ready === 'boolean'
        ? (data.models_ready as number | boolean)
        : undefined,
  };
}

function parseModel(data: unknown): ModelInfo {
  if (!isRecord(data) || typeof data.id !== 'string' || typeof data.name !== 'string' || typeof data.status !== 'string') {
    throw invalid('models: each entry needs "id", "name" and "status"');
  }
  return {
    id: data.id,
    name: data.name,
    architecture: optString(data.architecture),
    status: data.status,
    input_size: optSize(data.input_size),
    is_default: data.is_default === true,
    note: optString(data.note),
  };
}

export function parseModels(data: unknown): ModelsResponse {
  if (!isRecord(data) || !Array.isArray(data.models)) throw invalid('models: missing "models" array');
  return { models: data.models.map(parseModel) };
}

export function parseAnalyze(data: unknown): AnalyzeResponse {
  if (!isRecord(data)) throw invalid('analyze: not a JSON object');
  if (data.success === false) {
    const reason = optString(data.message) ?? optString(data.error) ?? optString(data.detail);
    throw new ApiError(reason ?? 'The backend reported that the analysis failed.', 'http');
  }

  // Check if response is from VeriStream forensic engine
  if (isRecord(data.report)) {
    const report = data.report as Record<string, unknown>;
    const rawVerdict = typeof report.verdict === 'string' ? report.verdict : 'UNKNOWN';
    const manipulationProb = isFiniteNumber(report.manipulation_probability)
      ? (report.manipulation_probability as number)
      : 0;

    const pFake = Number((manipulationProb * 100).toFixed(2));
    const pReal = Number((Math.max(0, 100 - pFake)).toFixed(2));

    const isFake =
      rawVerdict.toUpperCase().includes('FAKE') ||
      rawVerdict.toUpperCase().includes('MANIPULATED') ||
      rawVerdict.toUpperCase().includes('AI_GENERATED') ||
      manipulationProb >= 0.5;

    const prediction = isFake ? 'Fake' : 'Real';
    const confidence = isFake ? pFake : pReal;

    const probabilities: Record<string, number> = {
      Fake: pFake,
      Real: pReal,
    };

    const rawViz = (isRecord(data.visualizations)
      ? data.visualizations
      : isRecord(report.visualizations)
      ? report.visualizations
      : {}) as Record<string, unknown>;

    const visualizations: Record<string, string> = {};
    for (const [k, v] of Object.entries(rawViz)) {
      if (typeof v === 'string') {
        visualizations[k] = resolveMediaUrl(v);
      }
    }

    const primaryHeatmap =
      visualizations.swin_gar ||
      visualizations.crossvit_gar ||
      visualizations.mesh_gar_overlay ||
      visualizations.face_mesh;

    const router = isRecord(report.router) ? (report.router as Record<string, unknown>) : undefined;
    const faceDetected = typeof router?.human_present === 'boolean' ? router.human_present : undefined;

    const runtimeSec = isFiniteNumber(report.api_runtime_sec)
      ? (report.api_runtime_sec as number)
      : isFiniteNumber(report.runtime_sec)
      ? (report.runtime_sec as number)
      : undefined;

    const warnings: string[] = [];
    if (isRecord(report.module_warnings)) {
      for (const [k, v] of Object.entries(report.module_warnings)) {
        if (typeof v === 'string' && v.trim()) warnings.push(`${k}: ${v}`);
      }
    }
    if (typeof report.gemini_error === 'string' && report.gemini_error.trim()) {
      warnings.push(`Gemini explanation note: ${report.gemini_error}`);
    }

    return {
      success: true,
      filename: optString(report.file) ?? optString(report.original_filename) ?? optString(data.filename),
      model_id: 'veristream',
      model_name: 'VeriStream Forensic Engine',
      model_used: 'VeriStream Multi-Stream Forensic Fusion',
      prediction,
      confidence,
      probabilities,
      inference_time_ms: runtimeSec !== undefined ? Math.round(runtimeSec * 1000) : undefined,
      device: optString(data.device) ?? optString(report.device),
      image_size: optSize(report.size),
      face_detected: faceDetected,
      heatmap: primaryHeatmap,
      warnings: warnings.length > 0 ? warnings : undefined,
      report: report as unknown as VeriStreamReport,
      visualizations,
      raw_verdict: rawVerdict,
      manipulation_probability: manipulationProb,
      evidence: Array.isArray(report.evidence) ? (report.evidence as unknown as VeriStreamEvidenceItem[]) : undefined,
      forensic_narrative: isRecord(report.forensic_narrative)
        ? (report.forensic_narrative as unknown as VeriStreamNarrative)
        : undefined,
    };
  }

  // Fallback to legacy single-model structure
  if (typeof data.prediction !== 'string' || !data.prediction) throw invalid('analyze: missing "prediction"');
  if (!isFiniteNumber(data.confidence)) throw invalid('analyze: missing numeric "confidence"');
  if (!isRecord(data.probabilities)) throw invalid('analyze: missing "probabilities"');

  const entries = Object.entries(data.probabilities);
  if (entries.length === 0 || !entries.every(([, v]) => isFiniteNumber(v))) {
    throw invalid('analyze: "probabilities" must map class names to numbers');
  }

  const values = entries.map(([, v]) => v as number);
  const sum = values.reduce((a, b) => a + b, 0);
  const isFraction = values.every((v) => v >= 0 && v <= 1) && Math.abs(sum - 1) < 0.02;
  const scale = isFraction ? 100 : 1;

  const warnings = Array.isArray(data.warnings)
    ? data.warnings.filter((w): w is string => typeof w === 'string' && w.length > 0)
    : undefined;

  return {
    success: true,
    filename: optString(data.filename),
    model_id: optString(data.model_id),
    model_name: optString(data.model_name),
    model_used: optString(data.model_used) ?? 'Not reported',
    prediction: data.prediction,
    confidence: isFraction && data.confidence <= 1 ? data.confidence * 100 : data.confidence,
    probabilities: Object.fromEntries(entries.map(([k, v]) => [k, (v as number) * scale])),
    inference_time_ms: isFiniteNumber(data.inference_time_ms) ? data.inference_time_ms : undefined,
    device: optString(data.device),
    image_size: optSize(data.image_size),
    face_detected: typeof data.face_detected === 'boolean' ? data.face_detected : undefined,
    heatmap: optString(data.heatmap),
    warnings: warnings && warnings.length > 0 ? warnings : undefined,
  };
}

/* ------------------------------------------------------------------ */
/* Transport                                                           */
/* ------------------------------------------------------------------ */

/** Extract a readable message from FastAPI error bodies (`detail` can be a string or a validation list). */
function describeHttpError(body: unknown, status: number): string {
  if (isRecord(body)) {
    const { detail } = body;
    if (typeof detail === 'string' && detail) return detail;
    if (Array.isArray(detail)) {
      const msgs = detail
        .map((d) => (isRecord(d) && typeof d.msg === 'string' ? d.msg : null))
        .filter((m): m is string => m !== null);
      if (msgs.length) return msgs.join('; ');
    }
    const msg = optString(body.message) ?? optString(body.error);
    if (msg) return msg;
  }
  if (status === 404) return 'The requested API endpoint was not found on the backend.';
  if (status === 413) return 'The image is too large for the server to accept.';
  if (status === 415) return 'The server does not accept this file type.';
  if (status === 503) return 'The detection service is temporarily unavailable.';
  if (status >= 500) return `The backend encountered an internal error (HTTP ${status}).`;
  return `Request failed with HTTP ${status}.`;
}

const NETWORK_MESSAGE = 'Cannot reach the Face-X analysis service. Make sure the backend is running.';

/** Turn a status + body into parsed data or a typed ApiError. Shared by fetch and XHR. */
function interpret<T>(status: number, text: string, parse: (data: unknown) => T): T {
  const ok = status >= 200 && status < 300;
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      if (ok) throw invalid('body is not JSON');
    }
  }
  // A 5xx with an empty body comes from a proxy (e.g. the Vite dev proxy) that
  // could not reach FastAPI, not from the application itself.
  if (!ok && status >= 500 && !text) throw new ApiError(NETWORK_MESSAGE, 'network', status);
  if (!ok) throw new ApiError(describeHttpError(data, status), 'http', status);
  return parse(data);
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: BodyInit;
  /** Sent as a JSON body (sets Content-Type). */
  json?: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
}

async function request<T>(path: string, parse: (data: unknown) => T, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', signal, timeoutMs = 10_000 } = opts;
  const body = opts.json !== undefined ? JSON.stringify(opts.json) : opts.body;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts.json !== undefined) headers['Content-Type'] = 'application/json';
  const controller = new AbortController();
  let timedOut = false;

  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);
  const timer = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    let res: Response;
    try {
      res = await fetch(apiUrl(path), {
        method,
        body,
        signal: controller.signal,
        headers,
      });
    } catch {
      if (timedOut) throw new ApiError('The backend took too long to respond.', 'timeout');
      if (signal?.aborted) throw new ApiError('Request cancelled.', 'aborted');
      throw new ApiError(NETWORK_MESSAGE, 'network');
    }

    return interpret(res.status, await res.text(), parse);
  } finally {
    window.clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export const getHealth = (signal?: AbortSignal) =>
  request(ENDPOINTS.health, parseHealth, { signal, timeoutMs: 6_000 });

export const getModels = (signal?: AbortSignal) =>
  request(ENDPOINTS.models, parseModels, { signal, timeoutMs: 6_000 });

/* ---------------- Reviews (moderated in a private Google Sheet via the backend) ---------------- */

export interface PublicReview {
  id: string;
  name: string | null;
  rating: number;
  feedback: string;
  submitted_at: string;
}

export interface ReviewsResult {
  /** False when the backend has no review integration configured. */
  enabled: boolean;
  reviews: PublicReview[];
  stale: boolean;
}

function parseReviews(data: unknown): ReviewsResult {
  if (!isRecord(data) || typeof data.enabled !== 'boolean' || !Array.isArray(data.reviews)) throw invalid('reviews');
  const reviews = data.reviews
    .filter(isRecord)
    .map((r) => ({
      id: String(r.id ?? ''),
      name: optString(r.name) ?? null,
      rating: Number(r.rating),
      feedback: String(r.feedback ?? ''),
      submitted_at: String(r.submitted_at ?? ''),
    }))
    .filter((r) => r.rating >= 1 && r.rating <= 5 && r.feedback);
  return { enabled: data.enabled, reviews, stale: data.stale === true };
}

export const getReviews = (signal?: AbortSignal) =>
  request('/api/reviews', parseReviews, { signal, timeoutMs: 15_000 });

export interface ReviewSubmission {
  name: string;
  rating: number;
  feedback: string;
  /** Honeypot field; always empty for real visitors. */
  website: string;
  /** Random per-attempt token so a retried request can't create a duplicate. */
  client_token: string;
}

export const submitReview = (review: ReviewSubmission) =>
  request(
    '/api/reviews',
    (data) => {
      if (!isRecord(data) || data.success !== true) throw invalid('review submission');
      return { id: String(data.id ?? ''), message: optString(data.message) ?? 'Thank you for your review.' };
    },
    { method: 'POST', json: review, timeoutMs: 20_000 },
  );

export interface AnalyzeResult {
  response: AnalyzeResponse;
  /** The untouched JSON body, kept for the "raw response" panel. */
  raw: unknown;
}

/**
 * Observable stages of a request. The server does not stream its own
 * progress, so these are exactly what the browser can measure.
 */
export type AnalyzeStage = 'uploading' | 'processing' | 'receiving';

export interface AnalyzeProgress {
  stage: AnalyzeStage;
  /** Fraction of the upload sent, 0–1 (only while uploading and when the size is known). */
  uploaded?: number;
}

export interface AnalyzeOptions {
  signal?: AbortSignal;
  onProgress?: (progress: AnalyzeProgress) => void;
  timeoutMs?: number;
  useGemini?: boolean;
  geminiApiKey?: string;
}

/**
 * POST /api/analyze. Uses XMLHttpRequest because fetch cannot report upload
 * progress. `modelId: null` lets the server run its configured default pipeline.
 */
export function analyzeImage(file: File, modelId: string | null, options: AnalyzeOptions = {}): Promise<AnalyzeResult> {
  // First inference may include model warm-up (CUDA init) or slow CPU inference.
  const { signal, onProgress, timeoutMs = 120_000, useGemini = false, geminiApiKey } = options;

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new ApiError('Analysis cancelled.', 'aborted'));
      return;
    }

    const form = new FormData();
    form.append('file', file, file.name);
    if (modelId) form.append('model_id', modelId);
    form.append('use_gemini', useGemini ? 'true' : 'false');
    if (geminiApiKey && geminiApiKey.trim()) {
      form.append('gemini_api_key', geminiApiKey.trim());
    }

    let queryParams = `?use_gemini=${useGemini ? 'true' : 'false'}`;
    if (geminiApiKey && geminiApiKey.trim()) {
      queryParams += `&gemini_api_key=${encodeURIComponent(geminiApiKey.trim())}`;
    }

    const xhr = new XMLHttpRequest();
    xhr.open('POST', apiUrl(`${ENDPOINTS.analyze}${queryParams}`));
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.timeout = timeoutMs;

    let stage: AnalyzeStage = 'uploading';
    const report = (p: AnalyzeProgress) => {
      stage = p.stage;
      onProgress?.(p);
    };

    xhr.upload.onprogress = (e) => {
      if (stage === 'uploading') report({ stage: 'uploading', uploaded: e.lengthComputable ? e.loaded / e.total : undefined });
    };
    xhr.upload.onload = () => report({ stage: 'processing' });
    xhr.onprogress = () => {
      if (stage !== 'receiving') report({ stage: 'receiving' });
    };

    const onAbortSignal = () => xhr.abort();
    const cleanup = () => signal?.removeEventListener('abort', onAbortSignal);
    signal?.addEventListener('abort', onAbortSignal);

    xhr.onload = () => {
      cleanup();
      try {
        let raw: unknown = null;
        const response = interpret(xhr.status, xhr.responseText, (data) => {
          raw = data;
          return parseAnalyze(data);
        });
        resolve({ response, raw });
      } catch (err) {
        reject(err);
      }
    };
    xhr.onerror = () => {
      cleanup();
      reject(new ApiError(NETWORK_MESSAGE, 'network'));
    };
    xhr.ontimeout = () => {
      cleanup();
      reject(new ApiError('The analysis took too long and was stopped. Try again, or use a smaller image.', 'timeout'));
    };
    xhr.onabort = () => {
      cleanup();
      reject(new ApiError('Analysis cancelled.', 'aborted'));
    };

    report({ stage: 'uploading', uploaded: 0 });
    xhr.send(form);
  });
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong.';
}
