import { useEffect, useState } from 'react';
import type { Tone } from '../ui';

export const toneFor = (label: string): Tone => (/fake/i.test(label) ? 'fake' : /real/i.test(label) ? 'real' : 'signal');

export const toneText: Record<Tone, string> = {
  fake: 'text-fake',
  real: 'text-real',
  signal: 'text-signal',
  caution: 'text-caution',
  neutral: 'text-mist',
};

/** Chart fills: the validated, darker steps of each hue (see tailwind.config.js). */
export const toneFill: Record<Tone, string> = {
  fake: 'bg-fake-fill',
  real: 'bg-real-fill',
  signal: 'bg-signal',
  caution: 'bg-caution',
  neutral: 'bg-mist',
};

export const toneStroke: Record<Tone, string> = {
  fake: 'stroke-fake',
  real: 'stroke-real',
  signal: 'stroke-signal',
  caution: 'stroke-caution',
  neutral: 'stroke-mist',
};

export const clamp = (v: number) => Math.min(100, Math.max(0, v));

/** True one frame after mount, so bars and rings can animate from zero. */
export function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return mounted;
}
