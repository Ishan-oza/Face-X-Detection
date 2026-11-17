import { useEffect, useState } from 'react';

export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · Face-X Detection` : 'Face-X Detection';
  }, [title]);
}

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

export const usePrefersReducedMotion = () => useMediaQuery('(prefers-reduced-motion: reduce)');

/** Whole seconds elapsed since `running` became true; resets when it turns false. */
export function useElapsedSeconds(running: boolean) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!running) {
      setSeconds(0);
      return;
    }
    const start = performance.now();
    const id = window.setInterval(() => setSeconds(Math.floor((performance.now() - start) / 1000)), 250);
    return () => window.clearInterval(id);
  }, [running]);
  return seconds;
}
