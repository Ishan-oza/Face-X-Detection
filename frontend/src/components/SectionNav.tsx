import { useEffect, useRef, useState } from 'react';
import { PageLink } from '../lib/navigation';
import { cx } from './ui';

export interface SectionLink {
  id: string;
  label: string;
}

/**
 * Sticky in-page navigation with scroll-spy. Links are same-page hash links, so
 * Layout scrolls to them smoothly; the active pill follows the reader.
 */
export function SectionNav({ sections }: { sections: SectionLink[] }) {
  const [active, setActive] = useState(sections[0]?.id);
  const barRef = useRef<HTMLDivElement>(null);
  const pillRefs = useRef<Record<string, HTMLAnchorElement | null>>({});

  useEffect(() => {
    const els = sections.map((s) => document.getElementById(s.id)).filter((el): el is HTMLElement => !!el);
    // A section is "current" while it crosses the middle band of the viewport.
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: '-40% 0px -55% 0px' },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [sections]);

  // On narrow screens the bar scrolls sideways; keep the active pill in view
  // by scrolling the bar only (never the page).
  useEffect(() => {
    const bar = barRef.current;
    const pill = active ? pillRefs.current[active] : null;
    if (!bar || !pill || bar.scrollWidth <= bar.clientWidth) return;
    bar.scrollTo({ left: pill.offsetLeft - bar.clientWidth / 2 + pill.offsetWidth / 2, behavior: 'smooth' });
  }, [active]);

  return (
    <nav aria-label="On this page" className="sticky top-16 z-40 md:top-20 border-b hairline bg-ink-950/80 backdrop-blur-xl">
      <div
        ref={barRef}
        className="shell flex items-center gap-1 overflow-x-auto py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <span className="eyebrow mr-4 hidden shrink-0 md:inline">On this page</span>
        {sections.map((s) => {
          const current = s.id === active;
          return (
            <PageLink
              key={s.id}
              ref={(el) => (pillRefs.current[s.id] = el)}
              to={{ hash: s.id }}
              replace
              aria-current={current ? 'location' : undefined}
              className={cx(
                'shrink-0 rounded-full px-3.5 py-1.5 text-sm transition-all duration-300 ease-out-expo active:scale-[0.96]',
                current
                  ? 'bg-signal/[0.1] text-signal shadow-[inset_0_0_0_1px_rgba(198,243,107,0.3)]'
                  : 'text-mist hover:bg-white/[0.04] hover:text-bone',
              )}
            >
              {s.label}
            </PageLink>
          );
        })}
      </div>
    </nav>
  );
}
