import { createElement, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

/*
 * Scroll-triggered reveal. One IntersectionObserver is shared by every
 * instance; each element is revealed once and then unobserved, so nothing
 * replays while scrolling back and forth. Under prefers-reduced-motion the
 * CSS in styles/index.css shows content immediately.
 */

const callbacks = new WeakMap<Element, () => void>();
let observer: IntersectionObserver | null = null;

function getObserver() {
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        callbacks.get(entry.target)?.();
        callbacks.delete(entry.target);
        observer?.unobserve(entry.target);
      }
    },
    // Trigger once the element's top passes ~90% of the viewport height.
    { rootMargin: '0px 0px -10% 0px', threshold: 0 },
  );
  return observer;
}

export function useReveal<T extends Element>() {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const obs = getObserver();
    callbacks.set(el, () => setVisible(true));
    obs.observe(el);
    return () => {
      callbacks.delete(el);
      obs.unobserve(el);
    };
  }, []);

  return [ref, visible] as const;
}

type Tag = 'div' | 'section' | 'article' | 'li' | 'ul' | 'ol' | 'p' | 'span' | 'header' | 'aside';

interface RevealProps {
  as?: Tag;
  /** Delay in ms, used for staggering siblings. Keep it short. */
  delay?: number;
  variant?: 'up' | 'fade' | 'scale';
  className?: string;
  id?: string;
  'aria-label'?: string;
  children: ReactNode;
}

/**
 * Don't put this on an element that has its own Tailwind `transition-*`
 * classes. Wrap that element instead, because both set `transition`.
 */
export function Reveal({
  as = 'div',
  delay = 0,
  variant = 'up',
  className,
  id,
  'aria-label': ariaLabel,
  children,
}: RevealProps) {
  const [ref, visible] = useReveal<HTMLElement>();
  const style = delay ? ({ '--reveal-delay': `${delay}ms` } as CSSProperties) : undefined;
  return createElement(
    as,
    {
      ref,
      id,
      style,
      'aria-label': ariaLabel,
      className: ['reveal', `reveal-${variant}`, visible && 'is-visible', className].filter(Boolean).join(' '),
    },
    children,
  );
}

/** Stagger helper: capped so long lists never wait noticeably. */
export const stagger = (index: number, step = 80, max = 400) => Math.min(index * step, max);
