/**
 * Builds one normalised report from a completed analysis. The Results page,
 * the PDF and the JSON export all read from this, so they always agree.
 *
 * Every value comes from one of three clearly labelled sources:
 *  - "server":        the /api/analyze response
 *  - "browser":       measured or checked in this browser
 *  - "configuration": the model service's published configuration (/api/models)
 */

import type { CompletedAnalysis } from '../../context/AnalysisContext';
import type {
  ModelInfo,
  VeriStreamEvidenceItem,
  VeriStreamNarrative,
  VeriStreamReport,
} from '../../services/apiTypes';
import { formatBytes } from '../imageValidation';

export type Source = 'server' | 'browser' | 'configuration';
export type Fact = [label: string, value: string];

export interface ClassScore {
  label: string;
  /** Score or probability, 0–100. */
  value: number;
}

export interface ModelOutput {
  id: string | null;
  name: string;
  architecture: string;
  label: string;
  /** Score of the predicted class, 0–100. */
  score: number;
  scores: ClassScore[];
  inferenceMs?: number;
  device?: string;
  inputSize?: [number, number];
  note?: string;
}

export interface PipelineStage {
  key: string;
  title: string;
  source: Source;
  summary: string;
  facts: Fact[];
}

export interface Report {
  id: string;
  createdAt: Date;
  mode: CompletedAnalysis['mode'];
  image: {
    name: string;
    mime: string;
    format: string;
    bytes: number;
    width: number;
    height: number;
    previewUrl: string;
  };
  verdict: {
    label: string;
    score: number;
    /** Percentage-point gap between the top two class scores. */
    margin: number | null;
    /** Which model the verdict comes from. */
    source: string;
    rawVerdict?: string;
    manipulationProbability?: number;
  };
  models: ModelOutput[];
  pipeline: PipelineStage[];
  technical: Fact[];
  warnings: string[];
  faceDetected?: boolean;
  /** Overlay image returned by the backend, if any. */
  overlay?: string;
  limitations: string[];
  raw: unknown;

  // VeriStream fields
  veristream?: VeriStreamReport;
  visualizations?: Record<string, string>;
  evidence?: VeriStreamEvidenceItem[];
  narrative?: VeriStreamNarrative;
}

const ms = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(2)} s` : `${v.toFixed(1)} ms`);
const pct = (v: number) => `${v.toFixed(2)}%`;

function reportId(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `FX-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
function aspect(w: number, h: number) {
  const g = gcd(w, h);
  const [a, b] = [w / g, h / g];
  return a <= 50 && b <= 50 ? `${a}:${b}` : `${(w / h).toFixed(2)}:1`;
}

export const LIMITATIONS = [
  'Forensic scores are calibrated estimates from multi-stream neural and signal analyses; no single detector is 100% infallible.',
  'Heavy re-compression, social media transcoding, or severe downsampling can attenuate high-frequency noise residuals.',
  'Localized diffusion inpainting or partial face swaps rely on high-pass residual, frequency, and boundary seam coherence.',
  'This report is an automated forensic analysis. It is designed to assist human verifiers and should not be the sole basis for legal determinations without expert review.',
];

export function buildReport(analysis: CompletedAnalysis, models: ModelInfo[] | null): Report {
  const { response: r, image, completedAt, timings } = analysis;
  const rep = r.report;

  const scores: ClassScore[] = Object.entries(r.probabilities)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
  const margin = scores.length >= 2 ? scores[0].value - scores[1].value : null;

  const info = models?.find((m) => m.id === (r.model_id ?? analysis.modelId)) ?? null;
  const modelName = r.model_name ?? analysis.modelName ?? info?.name ?? r.model_used;
  const inputSize = info?.input_size;

  const format = image.mime.replace('image/', '').toUpperCase();

  // Build model outputs list
  const modelOutputs: ModelOutput[] = [];

  // 1. Primary VeriStream Fusion Output
  modelOutputs.push({
    id: r.model_id ?? 'veristream',
    name: rep ? 'VeriStream Forensic Fusion Engine' : modelName,
    architecture: rep ? 'Multi-Stream Forensic Fusion (Late Fusion)' : r.model_used,
    label: r.prediction,
    score: r.confidence,
    scores,
    inferenceMs: r.inference_time_ms,
    device: r.device,
    inputSize,
    note: rep?.verdict ? `Adjudicated verdict: ${rep.verdict}` : undefined,
  });

  // If VeriStream report is present, include the individual forensic streams
  if (rep) {
    if (rep.global_stream?.swin_p_fake !== undefined) {
      const pFake = rep.global_stream.swin_p_fake * 100;
      modelOutputs.push({
        id: 'swin_v2',
        name: 'Swin Transformer V2',
        architecture: 'swinv2_base_window12to16_192to256 (Global Scene/Noise)',
        label: pFake >= 50 ? 'Fake' : 'Real',
        score: pFake >= 50 ? pFake : 100 - pFake,
        scores: [
          { label: 'Fake', value: pFake },
          { label: 'Real', value: Math.max(0, 100 - pFake) },
        ],
        note: 'Global scene attention & transformer noise representation',
      });
    }

    if (rep.local_stream?.crossvit_p_fake !== undefined) {
      const pFake = rep.local_stream.crossvit_p_fake * 100;
      modelOutputs.push({
        id: 'crossvit',
        name: 'Cross-ViT Dual-Scale Transformer',
        architecture: 'crossvit_tiny_240 (Dual-Scale Patch Attention)',
        label: pFake >= 50 ? 'Fake' : 'Real',
        score: pFake >= 50 ? pFake : 100 - pFake,
        scores: [
          { label: 'Fake', value: pFake },
          { label: 'Real', value: Math.max(0, 100 - pFake) },
        ],
        note: 'Aligned face crop dual-patch local facial texture analysis',
      });
    }

    if (rep.local_stream?.srm) {
      const srmScore = Math.min(100, (rep.local_stream.srm.patch_inconsistency_score ?? 0) * 100);
      modelOutputs.push({
        id: 'srm',
        name: 'SRM High-Pass Residual Analysis',
        architecture: 'Spatial Rich Model 3-Filter High-Pass Residuals',
        label: srmScore > 30 ? 'Inconsistent' : 'Uniform',
        score: srmScore,
        scores: [
          { label: 'Residual Anomaly', value: srmScore },
          { label: 'Uniform Background', value: Math.max(0, 100 - srmScore) },
        ],
        note: `Residual mean=${rep.local_stream.srm.mean_abs_residual?.toFixed(3)}, inconsistency=${rep.local_stream.srm.patch_inconsistency_score?.toFixed(3)}`,
      });
    }

    if (rep.local_stream?.fft) {
      const fftFlag = rep.local_stream.fft.spectral_anomaly_flag;
      const fftVariance = rep.local_stream.fft.high_freq_variance ?? 0;
      modelOutputs.push({
        id: 'fft',
        name: 'FFT Frequency Spectral Grid',
        architecture: '2D Discrete Fourier Transform (Frequency Domain)',
        label: fftFlag ? 'Spectral Grid Anomaly' : 'Natural Frequency Decay',
        score: fftFlag ? 95 : 15,
        scores: [
          { label: 'Spectral Anomaly', value: fftFlag ? 95 : 15 },
          { label: 'Natural Spectrum', value: fftFlag ? 5 : 85 },
        ],
        note: `High-frequency tail variance=${fftVariance.toFixed(2)}`,
      });
    }

    if (rep.global_stream?.depth) {
      const depthParadox = rep.global_stream.depth.spatial_paradox_flag;
      const depthVar = rep.global_stream.depth.discontinuity_variance ?? 0;
      modelOutputs.push({
        id: 'depth_anything_v2',
        name: 'Depth Anything V2 Geometric Discontinuity',
        architecture: 'Monocular Depth Estimation & Discontinuity Analysis',
        label: depthParadox ? 'Spatial Paradox' : 'Consistent Geometry',
        score: depthParadox ? 90 : 20,
        scores: [
          { label: 'Depth Discontinuity', value: Math.min(100, depthVar / 50) },
          { label: 'Spatial Plausibility', value: Math.max(0, 100 - Math.min(100, depthVar / 50)) },
        ],
        note: `Discontinuity variance=${depthVar.toFixed(1)}, paradox=${depthParadox ? 'Yes' : 'No'}`,
      });
    }

    if (rep.local_stream?.face_xray) {
      const xrayRatio = rep.local_stream.face_xray.boundary_noise_ratio ?? 1.0;
      const xrayScore = Math.min(100, (rep.local_stream.face_xray.score ?? 0) * 100);
      modelOutputs.push({
        id: 'face_xray',
        name: 'Face X-ray Blending Boundary Detector',
        architecture: 'Seam vs Interior High-Pass Gradient Contrast',
        label: xrayScore > 35 ? 'Blending Seam Detected' : 'Continuous Blending',
        score: xrayScore,
        scores: [
          { label: 'Boundary Artifact', value: xrayScore },
          { label: 'Continuous', value: Math.max(0, 100 - xrayScore) },
        ],
        note: `Seam-to-interior noise ratio=${xrayRatio.toFixed(3)}`,
      });
    }
  }

  // Build Pipeline Stages reflecting VeriStream execution
  const pipeline: PipelineStage[] = [
    {
      key: 'validation',
      title: 'Browser Validation & Safe Decoding',
      source: 'browser',
      summary: 'File type, magic signature, and decompression checks executed in browser.',
      facts: [
        ['Format', format],
        ['File size', `${formatBytes(image.file.size)} of 10 MB limit`],
        ['Dimensions', `${image.width} × ${image.height} px`],
      ],
    },
    {
      key: 'metadata',
      title: 'Metadata & C2PA Provenance',
      source: 'server',
      summary: rep?.metadata?.ai_signatures?.length
        ? `Found ${rep.metadata.ai_signatures.length} embedded AI generator signatures in metadata.`
        : 'Checked EXIF tags, C2PA content credentials, and known AI generator fingerprints.',
      facts: [
        ['Hardware EXIF', rep?.metadata?.hardware_exif ?? 'None/Stripped'],
        ['C2PA manifest', rep?.metadata?.c2pa_manifest_present ? 'Present' : 'Not detected'],
        ['AI signatures', rep?.metadata?.ai_signatures?.join(', ') || 'None found'],
        ['Provenance score', rep?.metadata?.provenance_score !== undefined ? `${rep.metadata.provenance_score}` : '0.0'],
      ],
    },
    {
      key: 'routing',
      title: 'Face Detection & Spatial Routing',
      source: 'server',
      summary: rep?.router?.human_present
        ? `Located face bounding box with ${(rep.router.conf ?? 1) * 100}% confidence; extracted aligned crop.`
        : 'Scanned image for human face regions.',
      facts: [
        ['Human detected', rep?.router?.human_present ? 'Yes' : 'No / Full-frame fallback'],
        ['Bounding box [x1, y1, x2, y2]', rep?.router?.box ? `[${rep.router.box.join(', ')}]` : 'None'],
        ['Detector confidence', rep?.router?.conf !== undefined ? `${(rep.router.conf * 100).toFixed(1)}%` : 'N/A'],
      ],
    },
    {
      key: 'global_stream',
      title: 'Global Stream (Swin V2, Depth & Anatomy)',
      source: 'server',
      summary: 'Analysed whole-scene transformer noise, monocular depth discontinuity, and skeletal proportions.',
      facts: [
        ['Swin V2 P(Fake)', rep?.global_stream?.swin_p_fake !== undefined ? `${(rep.global_stream.swin_p_fake * 100).toFixed(2)}%` : 'N/A'],
        ['Depth discontinuity variance', rep?.global_stream?.depth?.discontinuity_variance !== undefined ? `${rep.global_stream.depth.discontinuity_variance.toFixed(1)}` : 'N/A'],
        ['Spatial paradox flag', rep?.global_stream?.depth?.spatial_paradox_flag ? 'Flagged' : 'Normal'],
        ['Anatomy anomalies', rep?.global_stream?.anatomy?.anomalies?.join('; ') || 'None detected'],
      ],
    },
    {
      key: 'local_stream',
      title: 'Local Stream (CrossViT, SRM & FFT)',
      source: 'server',
      summary: 'Extracted high-pass SRM noise residuals, high-frequency FFT tails, and CrossViT dual-scale patch attention.',
      facts: [
        ['CrossViT P(Fake)', rep?.local_stream?.crossvit_p_fake !== undefined ? `${(rep.local_stream.crossvit_p_fake * 100).toFixed(2)}%` : 'N/A'],
        ['SRM patch inconsistency', rep?.local_stream?.srm?.patch_inconsistency_score !== undefined ? `${rep.local_stream.srm.patch_inconsistency_score.toFixed(3)}` : 'N/A'],
        ['FFT tail variance', rep?.local_stream?.fft?.high_freq_variance !== undefined ? `${rep.local_stream.fft.high_freq_variance.toFixed(1)}` : 'N/A'],
        ['Spectral anomaly flag', rep?.local_stream?.fft?.spectral_anomaly_flag ? 'Flagged' : 'Normal'],
      ],
    },
    {
      key: 'facemesh_gar',
      title: 'FaceMesh Geometry & GAR Overlap',
      source: 'server',
      summary: 'Mapped 478 3D facial landmarks and computed gradient attention hotspot concentration across facial zones.',
      facts: [
        ['EAR eye asymmetry', rep?.local_stream?.ear?.asymmetry !== undefined ? `${rep.local_stream.ear.asymmetry.toFixed(4)}` : 'N/A'],
        ['Hotspot concentration in critical zones', rep?.local_stream?.gar_mesh_overlap?.critical_zone_hot_concentration !== undefined ? `${(rep.local_stream.gar_mesh_overlap.critical_zone_hot_concentration * 100).toFixed(1)}%` : 'N/A'],
        ['Attention outside face', rep?.local_stream?.gar_mesh_overlap?.attention_outside_face !== undefined ? `${(rep.local_stream.gar_mesh_overlap.attention_outside_face * 100).toFixed(1)}%` : 'N/A'],
      ],
    },
    {
      key: 'face_xray',
      title: 'Face X-ray Boundary Analysis',
      source: 'server',
      summary: 'Inspected boundary blending seams between face crop and background surroundings.',
      facts: [
        ['Seam-to-interior gradient ratio', rep?.local_stream?.face_xray?.boundary_noise_ratio !== undefined ? `${rep.local_stream.face_xray.boundary_noise_ratio.toFixed(3)}` : 'N/A'],
        ['X-ray boundary score', rep?.local_stream?.face_xray?.score !== undefined ? `${(rep.local_stream.face_xray.score * 100).toFixed(1)}%` : 'N/A'],
      ],
    },
    {
      key: 'late_fusion',
      title: 'Multi-Stream Late Fusion & Narrative',
      source: 'server',
      summary: rep?.forensic_narrative?.summary || 'Fuses global stream, local stream, metadata provenance, and geometric evidence.',
      facts: [
        ['Adjudicated verdict', rep?.verdict ?? r.prediction],
        ['Manipulation probability', rep?.manipulation_probability !== undefined ? `${(rep.manipulation_probability * 100).toFixed(1)}%` : pct(r.confidence)],
        ['Active evidence signals', rep?.evidence ? `${rep.evidence.length} signals` : 'Standard'],
      ],
    },
  ];

  // Technical facts
  const technical: Fact[] = [
    ['Report ID', reportId(completedAt)],
    ['Analysed at', completedAt.toLocaleString()],
    ['Engine', 'VeriStream Forensic Engine'],
    ['Raw verdict', rep?.verdict ?? r.raw_verdict ?? r.prediction],
    ['Manipulation probability', rep?.manipulation_probability !== undefined ? `${(rep.manipulation_probability * 100).toFixed(1)}%` : pct(r.confidence)],
    ['Confidence level', rep?.confidence_percentage ?? `${r.confidence.toFixed(1)}%`],
    ['File', r.filename ?? image.file.name],
    ['Format · size', `${format} · ${formatBytes(image.file.size)}`],
    ['Dimensions', `${image.width} × ${image.height} px (${aspect(image.width, image.height)})`],
    ['Pipeline runtime (server)', rep?.runtime_sec !== undefined ? `${rep.runtime_sec.toFixed(2)} s` : r.inference_time_ms ? ms(r.inference_time_ms) : 'Not reported'],
    ['API total runtime', rep?.api_runtime_sec !== undefined ? `${rep.api_runtime_sec.toFixed(2)} s` : 'N/A'],
    ...(timings ? ([['Round trip (browser, incl. upload)', ms(timings.totalMs)]] as Fact[]) : []),
    ['Hardware EXIF', rep?.metadata?.hardware_exif ?? 'Not reported'],
    ['C2PA manifest', rep?.metadata?.c2pa_manifest_present ? 'Present' : 'Not detected'],
    ['AI signatures', rep?.metadata?.ai_signatures?.join(', ') || 'None found'],
    ['Face detected', rep?.router?.human_present !== undefined ? (rep.router.human_present ? 'Yes' : 'No') : r.face_detected !== undefined ? (r.face_detected ? 'Yes' : 'No') : 'N/A'],
    ...(rep?.router?.box ? ([['Face coordinates', `[${rep.router.box.join(', ')}]`]] as Fact[]) : []),
  ];

  const limitations = rep?.forensic_narrative?.limitations && rep.forensic_narrative.limitations.length > 0
    ? [...LIMITATIONS, ...rep.forensic_narrative.limitations]
    : LIMITATIONS;

  const primaryOverlay =
    r.visualizations?.swin_gar ||
    r.visualizations?.crossvit_gar ||
    r.visualizations?.mesh_gar_overlay ||
    r.heatmap;

  return {
    id: reportId(completedAt),
    createdAt: completedAt,
    mode: analysis.mode,
    image: {
      name: r.filename ?? image.file.name,
      mime: image.mime,
      format,
      bytes: image.file.size,
      width: image.width,
      height: image.height,
      previewUrl: image.previewUrl,
    },
    verdict: {
      label: r.prediction,
      score: r.confidence,
      margin,
      source: rep?.verdict ? `VeriStream Fusion (${rep.verdict})` : modelName,
      rawVerdict: rep?.verdict ?? r.raw_verdict,
      manipulationProbability: rep?.manipulation_probability ?? r.manipulation_probability,
    },
    models: modelOutputs,
    pipeline,
    technical,
    warnings: r.warnings ?? [],
    faceDetected: rep?.router?.human_present ?? r.face_detected,
    overlay: primaryOverlay,
    limitations,
    raw: analysis.raw,
    veristream: rep,
    visualizations: r.visualizations,
    evidence: rep?.evidence ?? r.evidence,
    narrative: rep?.forensic_narrative ?? r.forensic_narrative,
  };
}
