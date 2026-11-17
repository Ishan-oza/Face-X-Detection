import { useEffect, useState } from 'react';
import { usePrefersReducedMotion } from '../lib/hooks';
import { SpecimenFrame, cx } from './ui';

const N = 8; // 8×8 patch grid
const cells = Array.from({ length: N * N }, (_, i) => {
  // Deterministic pseudo-random texture so the grid looks like a patch map.
  const v = Math.abs(Math.sin(i * 12.9898 + 4.1) * 43758.5453) % 1;
  return 0.015 + v * 0.07;
});

/** Window rectangles in grid units for regular and shifted partitions. */
const REGULAR = [
  [0, 0, 4, 4],
  [4, 0, 4, 4],
  [0, 4, 4, 4],
  [4, 4, 4, 4],
];
const cuts = [0, 2, 6, 8];
const SHIFTED = cuts.slice(0, -1).flatMap((y, yi) =>
  cuts.slice(0, -1).map((x, xi) => [x, y, cuts[xi + 1] - x, cuts[yi + 1] - y]),
);

function Partition({ rects, highlight, visible }: { rects: number[][]; highlight: number[]; visible: boolean }) {
  return (
    <svg
      viewBox={`0 0 ${N} ${N}`}
      className={cx('absolute inset-0 h-full w-full transition-opacity duration-700', visible ? 'opacity-100' : 'opacity-0')}
      aria-hidden
    >
      <rect
        x={highlight[0]}
        y={highlight[1]}
        width={highlight[2]}
        height={highlight[3]}
        className="fill-signal/[0.08] stroke-signal"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
      {rects.map(([x, y, w, h]) => (
        <rect
          key={`${x}-${y}`}
          x={x}
          y={y}
          width={w}
          height={h}
          fill="none"
          className="stroke-bone/40"
          strokeWidth={1}
          strokeDasharray="3 3"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}

function FaceSketch() {
  const landmarks = [
    [39, 45],
    [61, 45],
    [50, 57],
    [42, 67],
    [58, 67],
  ];
  return (
    <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
      <g fill="none" className="stroke-bone/35" strokeWidth={0.5} strokeLinecap="round">
        <path d="M50 16c-15 0-25 12-25 29 0 10 2.5 18 7 25 4.5 7 11 12 18 12s13.5-5 18-12c4.5-7 7-15 7-25 0-17-10-29-25-29Z" />
        <path d="M33 40c3-2.5 7-3 11-1.5M56 38.5c4-1.5 8-1 11 1.5" />
        <path d="M34.5 45.5c2.5-2.2 6.8-2.2 9 0M56.5 45.5c2.3-2.2 6.6-2.2 9 0" />
        <path d="M50 46v9.5c-1.6 1-3.5 1.6-4.8 1.2M50 55.5c1.6 1 3.5 1.6 4.8 1.2" />
        <path d="M42 67c5 3 11 3 16 0M44 67.4c4 1 8 1 12 0" />
        <path d="M38 81.5c-1 5-1.2 9-1 13M62 81.5c1 5 1.2 9 1 13" />
      </g>
      <g className="stroke-signal" strokeWidth={0.6}>
        {landmarks.map(([x, y]) => (
          <g key={`${x}-${y}`}>
            <path d={`M${x - 2} ${y}h4M${x} ${y - 2}v4`} />
            <circle cx={x} cy={y} r={0.7} className="fill-signal" />
          </g>
        ))}
      </g>
    </svg>
  );
}

/**
 * Decorative illustration of Swin's window / shifted-window attention.
 * It is not a model output and never displays numbers.
 */
export function WindowAttentionVisual() {
  const reduced = usePrefersReducedMotion();
  const [shifted, setShifted] = useState(false);

  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => setShifted((s) => !s), 2800);
    return () => window.clearInterval(id);
  }, [reduced]);

  return (
    <figure className="relative">
      <SpecimenFrame
        active
        topLeft="Input · 256 × 256 · RGB"
        topRight={<span className="text-signal">{shifted ? 'SW-MSA · shifted' : 'W-MSA · regular'}</span>}
        bottomLeft="Patch grid · illustrative"
        bottomRight={`Layer ${shifted ? 'ℓ + 1' : 'ℓ'}`}
      >
        <div className="relative aspect-square overflow-hidden rounded-lg bg-ink-900">
          <div className="absolute inset-0 grid grid-cols-8 grid-rows-8">
            {cells.map((a, i) => (
              <div key={i} className="border-[0.5px] border-white/[0.04]" style={{ background: `rgba(198,243,107,${a})` }} />
            ))}
          </div>
          <FaceSketch />
          <Partition rects={REGULAR} highlight={[0, 0, 4, 4]} visible={!shifted} />
          <Partition rects={SHIFTED} highlight={[2, 2, 4, 4]} visible={shifted} />
          <div
            aria-hidden
            className="absolute inset-x-0 h-1/4 animate-scan bg-gradient-to-b from-transparent via-signal/[0.12] to-transparent"
          >
            <div className="absolute inset-x-0 bottom-1/2 h-px bg-signal/50" />
          </div>
        </div>
      </SpecimenFrame>
      <figcaption className="mt-4 max-w-md px-3 text-xs leading-relaxed text-mist sm:px-4">
        <span className="text-bone">Illustration, not a result.</span> Swin attends within local windows, then shifts
        the partition so neighbouring windows exchange information. Face landmarks are shown for orientation only.
      </figcaption>
    </figure>
  );
}
