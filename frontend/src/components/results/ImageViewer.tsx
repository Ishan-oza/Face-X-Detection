import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { cx, SpecimenFrame } from '../ui';

export interface VisualizationItem {
  id: string;
  label: string;
  url: string;
  description?: string;
}

/** Before/after wipe between two square images. */
function CompareSlider({ base, overlay, label }: { base: string; overlay: string; label: string }) {
  const [pos, setPos] = useState(50);
  const box = useRef<HTMLDivElement>(null);
  const drag = (e: PointerEvent) => {
    const r = box.current!.getBoundingClientRect();
    setPos(Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)));
  };
  const onKey = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 2;
    if (e.key === 'ArrowLeft') setPos((p) => Math.max(0, p - step));
    if (e.key === 'ArrowRight') setPos((p) => Math.min(100, p + step));
  };
  return (
    <div
      ref={box}
      className="relative aspect-square w-full touch-none select-none overflow-hidden rounded-xl bg-ink-900"
      onPointerDown={(e) => {
        (e.target as Element).setPointerCapture(e.pointerId);
        drag(e);
      }}
      onPointerMove={(e) => e.buttons && drag(e)}
    >
      <img src={base} alt="" className="absolute inset-0 h-full w-full object-contain" />
      <img
        src={overlay}
        alt={label}
        className="absolute inset-0 h-full w-full object-contain"
        style={{ clipPath: `inset(0 0 0 ${pos}%)` }}
      />
      <div
        role="slider"
        tabIndex={0}
        aria-label="Comparison position"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pos)}
        onKeyDown={onKey}
        className="absolute inset-y-0 w-0.5 -translate-x-1/2 cursor-ew-resize bg-signal"
        style={{ left: `${pos}%` }}
      >
        <span className="absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-signal bg-ink-950" />
      </div>
    </div>
  );
}

interface Props {
  src: string;
  name: string;
  width: number;
  height: number;
  inputSize?: [number, number];
  /** Primary overlay returned by the backend. */
  overlay?: string;
  caption?: string;
  visualizations?: Record<string, string>;
}

export function ImageViewer({ src, name, width, height, overlay, caption, visualizations = {} }: Props) {
  // Build views list
  const vizKeys: Array<{ key: string; label: string; desc: string }> = [
    { key: 'swin_gar', label: 'Swin Heatmap', desc: 'Swin V2 Gradient Attention Rollout (GAR) scene-level heatmap' },
    { key: 'crossvit_gar', label: 'CrossViT Heatmap', desc: 'CrossViT dual-scale patch attention on face crop' },
    { key: 'mesh_gar_overlay', label: 'Mesh Overlay', desc: 'FaceMesh 3D landmarks overlaid on attention hotspots' },
    { key: 'face_mesh', label: 'FaceMesh', desc: 'MediaPipe 478 3D facial landmark mesh & EAR' },
    { key: 'depth_map', label: 'Depth Map', desc: 'Depth Anything V2 monocular depth estimation & discontinuity' },
    { key: 'srm_residual', label: 'SRM Noise', desc: 'Spatial Rich Model high-pass noise residuals' },
    { key: 'fft_spectrum', label: 'FFT Spectrum', desc: '2D Fourier transform frequency distribution grid' },
    { key: 'xray_map', label: 'Face X-ray', desc: 'Face X-ray boundary blending seam detection' },
    { key: 'pose', label: 'Pose Anatomy', desc: 'MediaPipe macro-anatomy skeletal pose & proportion check' },
    { key: 'face_crop', label: 'Face Crop', desc: 'Aligned and normalized face crop used for local stream' },
  ];

  const availableViz = vizKeys.filter((v) => Boolean(visualizations[v.key]));

  type ViewMode = 'original' | 'compare' | string;
  const [activeView, setActiveView] = useState<ViewMode>('original');

  // If activeView is a visualization key, get its details
  const activeVizItem = availableViz.find((v) => v.key === activeView);
  const activeImageUrl = activeVizItem
    ? visualizations[activeVizItem.key]
    : activeView === 'overlay' && overlay
    ? overlay
    : src;

  const compareTargetUrl =
    visualizations.swin_gar ||
    visualizations.mesh_gar_overlay ||
    visualizations.crossvit_gar ||
    overlay ||
    activeImageUrl;

  return (
    <SpecimenFrame
      active
      topLeft={name}
      topRight={activeVizItem ? activeVizItem.label : `${width} × ${height} px`}
      bottomLeft={caption}
    >
      {/* View selector tabs */}
      <div
        role="tablist"
        aria-label="Forensic image view"
        className="mb-3 flex flex-wrap gap-1 rounded-xl border border-white/10 bg-ink-950/60 p-1"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeView === 'original'}
          onClick={() => setActiveView('original')}
          className={cx(
            'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors duration-200',
            activeView === 'original' ? 'bg-white/[0.12] text-bone font-semibold' : 'text-mist hover:text-bone',
          )}
        >
          Original
        </button>

        {compareTargetUrl && compareTargetUrl !== src && (
          <button
            type="button"
            role="tab"
            aria-selected={activeView === 'compare'}
            onClick={() => setActiveView('compare')}
            className={cx(
              'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors duration-200',
              activeView === 'compare' ? 'bg-signal/20 text-signal font-semibold' : 'text-mist hover:text-bone',
            )}
          >
            Compare Slider
          </button>
        )}

        {availableViz.map((v) => (
          <button
            key={v.key}
            type="button"
            role="tab"
            aria-selected={activeView === v.key}
            onClick={() => setActiveView(v.key)}
            className={cx(
              'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors duration-200',
              activeView === v.key ? 'bg-signal/20 text-signal font-semibold' : 'text-mist hover:text-bone',
            )}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div key={activeView} className="animate-fade-up-fast">
        {activeView === 'compare' && compareTargetUrl ? (
          <CompareSlider base={src} overlay={compareTargetUrl} label="Forensic Heatmap Comparison" />
        ) : (
          <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-ink-900">
            <div aria-hidden className="bg-grid absolute inset-0 opacity-60" />
            <img
              src={activeImageUrl}
              alt={activeVizItem ? activeVizItem.desc : `Analysed image ${name}`}
              style={{ viewTransitionName: 'specimen-image' }}
              className="relative max-h-full max-w-full object-contain"
            />
          </div>
        )}
      </div>

      {activeVizItem && (
        <p className="mt-3 text-xs leading-relaxed text-mist">
          <strong className="text-bone">{activeVizItem.label}:</strong> {activeVizItem.desc}
        </p>
      )}
      {activeView === 'compare' && (
        <p className="mt-3 text-xs leading-relaxed text-mist">
          Drag the center handle horizontally or use left/right arrow keys to wipe between the original capture and the
          primary forensic attention overlay.
        </p>
      )}
    </SpecimenFrame>
  );
}
