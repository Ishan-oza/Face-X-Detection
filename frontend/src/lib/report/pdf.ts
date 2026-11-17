/**
 * PDF report, generated entirely in the browser with jsPDF (loaded on demand).
 * Contents mirror the Results page: verdict, class scores, model outputs,
 * pipeline stages, technical details and limitations — nothing more.
 */

import type { Report } from './buildReport';
import { downloadBlob } from './download';

type RGB = [number, number, number];
const INK: RGB = [17, 20, 26];
const MUTED: RGB = [96, 104, 118];
const RULE: RGB = [222, 225, 230];
const PANEL: RGB = [246, 247, 249];
const ACCENT: RGB = [120, 160, 30]; // lime, darkened for print legibility
// Chart fills validated for light mode with the dataviz palette checker.
const FAKE: RGB = [232, 85, 63];
const REAL: RGB = [30, 159, 115];
const NEUTRAL: RGB = [110, 118, 132];

const classColor = (label: string): RGB => (/fake/i.test(label) ? FAKE : /real/i.test(label) ? REAL : NEUTRAL);

/** jsPDF's built-in fonts use WinAnsi encoding; map the few characters it lacks. */
const safe = (s: string) =>
  s.replace(/→/g, '->').replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/[^\x09\x0A\x0D\x20-\x7E -ÿ–—‘’“”•…·×]/g, '');

/** Fetch a same-origin asset as a data URL, or null if it isn't available. */
async function loadDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Re-encode the image as JPEG (handles WebP), capped in size to keep the PDF small. */
async function imageForPdf(src: string, maxSide = 1400) {
  const img = new Image();
  img.src = src;
  await img.decode();
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return { data: canvas.toDataURL('image/jpeg', 0.88), w: canvas.width, h: canvas.height };
}

export async function generatePdf(report: Report): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  doc.setProperties({
    title: `Face-X Detection report ${report.id}`,
    subject: 'Image authenticity analysis',
    creator: 'Face-X Detection',
  });

  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 18; // margin
  const CW = W - 2 * M; // content width
  let y = 0;

  const color = (c: RGB, kind: 'text' | 'fill' | 'draw' = 'text') =>
    kind === 'text' ? doc.setTextColor(...c) : kind === 'fill' ? doc.setFillColor(...c) : doc.setDrawColor(...c);
  const font = (style: 'normal' | 'bold', size: number, family: 'helvetica' | 'courier' = 'helvetica') => {
    doc.setFont(family, style);
    doc.setFontSize(size);
  };
  const ensure = (needed: number) => {
    if (y + needed > H - 20) {
      doc.addPage();
      y = M;
    }
  };
  const text = (s: string, x: number, yy: number, opts?: Parameters<typeof doc.text>[3]) => doc.text(safe(s), x, yy, opts);
  const wrap = (s: string, width: number) => doc.splitTextToSize(safe(s), width) as string[];

  const section = (title: string) => {
    ensure(16);
    y += 4;
    font('bold', 8);
    color(ACCENT);
    text(title.toUpperCase(), M, y, { charSpace: 0.6 });
    y += 2;
    color(RULE, 'draw');
    doc.setLineWidth(0.2);
    doc.line(M, y, W - M, y);
    y += 6;
  };

  const factTable = (facts: Array<[string, string]>, x = M, width = CW, labelWidth = width * 0.42) => {
    for (const [k, v] of facts) {
      const lines = wrap(v, width - labelWidth - 2);
      const h = Math.max(5.2, lines.length * 4.4 + 1);
      ensure(h + 1);
      font('normal', 8.5);
      color(MUTED);
      text(k, x, y);
      font('normal', 8.5, 'courier');
      color(INK);
      doc.text(lines, x + labelWidth, y);
      y += h;
      color(RULE, 'draw');
      doc.setLineWidth(0.1);
      doc.line(x, y - 2.6, x + width, y - 2.6);
    }
  };

  // ---- Header band ---------------------------------------------------------
  color(INK, 'fill');
  doc.rect(0, 0, W, 30, 'F');
  // Brand mark (transparent PNG). Skipped if it can't be loaded; the report still renders.
  let textX = M;
  const mark = await loadDataUrl('/brand/facex-mark.png');
  if (mark) {
    const markH = 17;
    doc.addImage(mark, 'PNG', M, 6.5, markH * (429 / 388), markH);
    textX = M + markH * (429 / 388) + 4;
  }
  font('bold', 13);
  color([236, 231, 220]);
  text('FACE-X DETECTION', textX, 13);
  font('normal', 9);
  color([170, 178, 190]);
  text('Image authenticity analysis report', textX, 19.5);
  font('normal', 8.5, 'courier');
  text(report.id, W - M, 13, { align: 'right' });
  text(report.createdAt.toLocaleString(), W - M, 19.5, { align: 'right' });
  y = 42;

  // ---- Summary -------------------------------------------------------------
  const verdictColor = classColor(report.verdict.label);
  color(PANEL, 'fill');
  doc.roundedRect(M, y - 6, CW, 34, 2, 2, 'F');
  color(verdictColor, 'fill');
  doc.rect(M, y - 6, 1.6, 34, 'F');
  font('normal', 8);
  color(MUTED);
  text('MODEL VERDICT', M + 7, y, { charSpace: 0.6 });
  font('bold', 26);
  color(verdictColor);
  text(report.verdict.label.toUpperCase(), M + 7, y + 13);
  font('normal', 8.5);
  color(MUTED);
  text(`from ${report.verdict.source}`, M + 7, y + 21);
  // Score block
  font('normal', 8);
  text('MODEL SCORE', W - M - 7, y, { align: 'right' });
  font('bold', 22, 'courier');
  color(INK);
  text(`${report.verdict.score.toFixed(2)}%`, W - M - 7, y + 12, { align: 'right' });
  font('normal', 7.5);
  color(MUTED);
  text('softmax score, not a calibrated probability', W - M - 7, y + 18, { align: 'right' });
  if (report.verdict.margin !== null)
    text(`margin over next class: ${report.verdict.margin.toFixed(2)} points`, W - M - 7, y + 22.5, { align: 'right' });
  y += 38;

  // ---- Image + file facts ---------------------------------------------------
  section('Analysed image');
  try {
    const img = await imageForPdf(report.image.previewUrl);
    const boxW = 72;
    const boxH = 72;
    const s = Math.min(boxW / img.w, boxH / img.h);
    const iw = img.w * s;
    const ih = img.h * s;
    ensure(boxH + 4);
    const top = y - 2;
    color(PANEL, 'fill');
    doc.rect(M, top, boxW, boxH, 'F');
    doc.addImage(img.data, 'JPEG', M + (boxW - iw) / 2, top + (boxH - ih) / 2, iw, ih);
    const before = y;
    factTable(
      [
        ['File', report.image.name],
        ['Format', report.image.format],
        ['File size', `${(report.image.bytes / 1024).toFixed(1)} KB`],
        ['Dimensions', `${report.image.width} × ${report.image.height} px`],
        ['Analysis mode', report.mode === 'advanced' ? 'Advanced' : 'Standard'],
      ],
      M + boxW + 8,
      CW - boxW - 8,
      34,
    );
    y = Math.max(y, before + boxH) + 2;
  } catch {
    factTable([['Image', 'Could not be embedded']]);
  }

  // ---- Class scores ---------------------------------------------------------
  section('Class scores');
  const model = report.models[0];
  for (const s of model.scores) {
    ensure(10);
    font('normal', 9);
    color(INK);
    text(s.label, M, y);
    font('normal', 9, 'courier');
    text(`${s.value.toFixed(2)}%`, W - M, y, { align: 'right' });
    y += 2.2;
    color(PANEL, 'fill');
    doc.roundedRect(M, y, CW, 2.6, 1.3, 1.3, 'F');
    color(classColor(s.label), 'fill');
    const w = Math.max(1.5, (CW * Math.min(100, Math.max(0, s.value))) / 100);
    doc.roundedRect(M, y, w, 2.6, 1.3, 1.3, 'F');
    y += 8;
  }
  font('normal', 7.5);
  color(MUTED);
  for (const line of wrap('Scores are softmax outputs of the classifier. They indicate the model’s preference between classes and are not calibrated probabilities.', CW)) {
    text(line, M, y);
    y += 3.6;
  }
  y += 2;

  // ---- Model outputs --------------------------------------------------------
  section('Model outputs');
  for (const m of report.models) {
    factTable([
      ['Model', m.name],
      ['Architecture', m.architecture],
      ['Prediction', `${m.label} (${m.score.toFixed(2)}%)`],
      ['Device', m.device ?? 'Not reported'],
      ['Inference time', m.inferenceMs !== undefined ? `${m.inferenceMs.toFixed(1)} ms` : 'Not reported'],
    ]);
  }
  font('normal', 7.5);
  color(MUTED);
  ensure(6);
  text('The final verdict is taken directly from this model; no fusion step was applied.', M, y);
  y += 4;

  // ---- Pipeline --------------------------------------------------------------
  section('Analysis pipeline');
  const SRC = { browser: 'Browser', server: 'Server', configuration: 'Configuration' } as const;
  report.pipeline.forEach((stage, i) => {
    const summary = wrap(stage.summary, CW - 10);
    // Keep each stage (title, summary, facts) together on one page.
    ensure(10 + summary.length * 4 + stage.facts.length * 5.4);
    font('bold', 9.5);
    color(INK);
    text(`${String(i + 1).padStart(2, '0')}  ${stage.title}`, M, y);
    font('normal', 7);
    color(MUTED);
    // No charSpace on right-aligned text: jsPDF adds it after alignment, overrunning the margin.
    text(SRC[stage.source].toUpperCase(), W - M, y, { align: 'right' });
    y += 4.5;
    font('normal', 8.5);
    color(MUTED);
    doc.text(summary, M + 7, y);
    y += summary.length * 4 + 1;
    if (stage.facts.length) factTable(stage.facts, M + 7, CW - 7, 52);
    y += 2;
  });

  // ---- Technical details -----------------------------------------------------
  section('Technical details');
  factTable(report.technical);

  if (report.warnings.length) {
    section('Service notes');
    font('normal', 8.5);
    color(INK);
    for (const w of report.warnings) {
      const lines = wrap(`• ${w}`, CW);
      ensure(lines.length * 4.2);
      doc.text(lines, M, y);
      y += lines.length * 4.2 + 1;
    }
  }

  // ---- Limitations -----------------------------------------------------------
  section('Limitations');
  font('normal', 8.5);
  for (const l of report.limitations) {
    const lines = wrap(l, CW - 5);
    ensure(lines.length * 4.2 + 2);
    color(ACCENT, 'fill');
    doc.circle(M + 1, y - 1.1, 0.7, 'F');
    color(INK);
    doc.text(lines, M + 5, y);
    y += lines.length * 4.2 + 2;
  }

  // ---- Footer on every page --------------------------------------------------
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    color(RULE, 'draw');
    doc.setLineWidth(0.2);
    doc.line(M, H - 13, W - M, H - 13);
    font('normal', 7);
    color(MUTED);
    text(`Face-X Detection · ${report.id} · Automated model output, not legal or forensic evidence.`, M, H - 8.5);
    text(`Page ${p} of ${pages}`, W - M, H - 8.5, { align: 'right' });
  }

  return doc.output('blob');
}

export async function downloadPdf(report: Report) {
  const blob = await generatePdf(report);
  downloadBlob(blob, `face-x-${report.id}.pdf`);
}
