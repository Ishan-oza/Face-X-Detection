/**
 * Response shapes for the Face-X FastAPI backend / VeriStream Forensic Engine.
 * Supports both standard legacy responses and full multi-stream VeriStream reports.
 */

/** GET /api/health */
export interface HealthResponse {
  status: string;
  service?: string;
  device?: string;
  gpu_name?: string;
  /** Number of models loaded or boolean ready status. */
  models_ready?: number | boolean;
}

/** Known values; any other string from the backend is displayed verbatim. */
export type ModelStatus = 'ready' | 'loading' | 'unavailable' | 'error' | (string & {});

export interface ModelInfo {
  id: string;
  name: string;
  /** Exact architecture identifier, e.g. "swinv2_tiny_window16_256". */
  architecture?: string;
  status: ModelStatus;
  input_size?: [number, number];
  is_default?: boolean;
  note?: string;
}

/** GET /api/models */
export interface ModelsResponse {
  models: ModelInfo[];
}

/* ------------------------------------------------------------------ */
/* VeriStream Forensic Report Types                                   */
/* ------------------------------------------------------------------ */

export interface VeriStreamMetadata {
  hardware_exif?: string;
  c2pa_manifest_present?: boolean;
  ai_signatures?: string[];
  provenance_score?: number;
  verdict?: string;
  [key: string]: unknown;
}

export interface VeriStreamRouter {
  human_present?: boolean;
  box?: [number, number, number, number];
  conf?: number;
  [key: string]: unknown;
}

export interface VeriStreamDepth {
  discontinuity_variance?: number;
  spatial_paradox_flag?: boolean;
  [key: string]: unknown;
}

export interface VeriStreamAnatomy {
  status?: string;
  angles?: Record<string, unknown>;
  anatomical_anomaly_flag?: boolean;
  anomalies?: string[];
  [key: string]: unknown;
}

export interface VeriStreamGlobalStream {
  swin_p_fake?: number;
  depth?: VeriStreamDepth;
  anatomy?: VeriStreamAnatomy;
  global_stream_suspicious?: boolean;
  [key: string]: unknown;
}

export interface VeriStreamSrm {
  mean_abs_residual?: number;
  std?: number;
  patch_inconsistency_score?: number;
  [key: string]: unknown;
}

export interface VeriStreamFft {
  high_freq_variance?: number;
  spectral_anomaly_flag?: boolean;
  [key: string]: unknown;
}

export interface VeriStreamEar {
  left?: number;
  right?: number;
  asymmetry?: number;
  structural_anomaly_flag?: boolean;
  [key: string]: unknown;
}

export interface VeriStreamFaceMeshRedZones {
  local_red_parts?: string[];
  local_part_scores?: Record<string, number>;
  global_red_parts?: string[];
  global_part_scores?: Record<string, number>;
  summary_text?: string;
}

export interface VeriStreamGarMeshOverlap {
  face?: Record<string, number>;
  boundary_band?: Record<string, number>;
  eyes?: Record<string, number>;
  mouth?: Record<string, number>;
  nose?: Record<string, number>;
  skin?: Record<string, number>;
  attention_outside_face?: number;
  critical_zone_hot_concentration?: number;
  [key: string]: unknown;
}

export interface VeriStreamFaceXray {
  boundary_noise_ratio?: number;
  score?: number;
  [key: string]: unknown;
}

export interface VeriStreamLocalStream {
  srm?: VeriStreamSrm;
  crossvit_p_fake?: number;
  fft?: VeriStreamFft;
  ear?: VeriStreamEar;
  facemesh_red_zones?: VeriStreamFaceMeshRedZones;
  gar_mesh_overlap?: VeriStreamGarMeshOverlap;
  face_xray?: VeriStreamFaceXray;
  local_stream_suspicious?: boolean;
  [key: string]: unknown;
}

export interface VeriStreamEvidenceItem {
  name: string;
  stream: 'global' | 'local' | string;
  key: string;
  score: number;
  note?: string;
}

export interface VeriStreamNarrative {
  verdict?: string;
  confidence?: number;
  plain_english_explanation?: string;
  summary?: string;
  key_evidence?: string[];
  visual_observations?: string[];
  limitations?: string[];
}

export interface VeriStreamReport {
  file?: string;
  size?: [number, number];
  metadata?: VeriStreamMetadata;
  router?: VeriStreamRouter;
  global_stream?: VeriStreamGlobalStream;
  local_stream?: VeriStreamLocalStream;
  module_warnings?: Record<string, unknown>;
  verdict: string;
  manipulation_probability: number;
  confidence_percentage?: string;
  evidence?: VeriStreamEvidenceItem[];
  forensic_narrative?: VeriStreamNarrative;
  runtime_sec?: number;
  api_runtime_sec?: number;
  original_filename?: string;
  visualizations?: Record<string, string>;
  gemini_error?: string;
  [key: string]: unknown;
}

/** POST /api/analyze response with full VeriStream compatibility */
export interface AnalyzeResponse {
  success: boolean;
  filename?: string;
  model_id?: string;
  /** Display name, e.g. "VeriStream Multi-Stream Forensic Fusion". */
  model_name?: string;
  /** Exact architecture identifier. */
  model_used: string;
  /** Class label, e.g. "Fake" or "Real" or formatted verdict. */
  prediction: string;
  /** Confidence of the predicted class, 0–100. */
  confidence: number;
  /** Per-class probabilities, 0–100. */
  probabilities: Record<string, number>;
  inference_time_ms?: number;
  device?: string;
  /** Original image width and height in pixels. */
  image_size?: [number, number];
  /** Present when face routing is active. */
  face_detected?: boolean;
  /** Primary heatmap/attention overlay URL. */
  heatmap?: string;
  /** Free-form caveats or warnings. */
  warnings?: string[];

  // Full VeriStream output:
  report?: VeriStreamReport;
  visualizations?: Record<string, string>;
  raw_verdict?: string;
  manipulation_probability?: number;
  evidence?: VeriStreamEvidenceItem[];
  forensic_narrative?: VeriStreamNarrative;
}
