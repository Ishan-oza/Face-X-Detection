import type { CompletedAnalysis } from '../../context/AnalysisContext';
import type { Report } from './buildReport';
import { downloadBlob } from './download';

/**
 * JSON export. `response` is the untouched body returned by POST /api/analyze;
 * everything else is clearly separated context recorded in the browser.
 */
export function buildJsonExport(report: Report, analysis: CompletedAnalysis) {
  return {
    format: 'face-x-analysis',
    version: 1,
    report_id: report.id,
    exported_at: new Date().toISOString(),
    analysed_at: analysis.completedAt.toISOString(),
    request: {
      endpoint: 'POST /api/analyze',
      mode: analysis.mode,
      // Standard mode sends no model_id, so the server runs its configured default.
      model_id_sent: analysis.mode === 'advanced' ? analysis.modelId : null,
    },
    image: {
      name: report.image.name,
      mime_type: report.image.mime,
      size_bytes: report.image.bytes,
      width: report.image.width,
      height: report.image.height,
    },
    // Measured in the browser: upload + server processing + download.
    client_round_trip_ms: analysis.timings ? round(analysis.timings.totalMs) : null,
    notes: {
      scores: 'Values in response.probabilities and response.confidence are softmax scores (0-100), not calibrated probabilities.',
    },
    response: analysis.raw,
  };
}

const round = (v: number) => Math.round(v * 10) / 10;

export function downloadJson(report: Report, analysis: CompletedAnalysis) {
  const body = JSON.stringify(buildJsonExport(report, analysis), null, 2);
  downloadBlob(new Blob([body], { type: 'application/json' }), `face-x-${report.id}.json`);
}
