import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Mail, Menu, X } from 'lucide-react';
import { useAnalysis } from '../context/AnalysisContext';
import { TEAM } from '../data/project';
import { PageLink, PageNavLink } from '../lib/navigation';
import { Logo } from './Logo';
import { cx } from './ui';

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/detect', label: 'Detect' },
  { to: '/results', label: 'Results' },
  { to: '/about', label: 'About' },
];

const SYSTEM_LINKS = [
  { to: '/about#architecture', label: 'Architecture' },
  { to: '/about#pipeline', label: 'Pipeline' },
  { to: '/about#models', label: 'Models' },
  { to: '/about#explainability', label: 'Explainability' },
  { to: '/about#team', label: 'Team' },
];

function useScrolled(offset = 8) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    // setState with an unchanged boolean is a no-op, so this stays cheap.
    const update = () => setScrolled(window.scrollY > offset);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, [offset]);
  return scrolled;
}

const isActive = (to: string, end: boolean | undefined, pathname: string) =>
  end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`);

/** A dot on "Results" while an analysis is waiting to be viewed. */
function ResultDot({ show }: { show: boolean }) {
  return show ? (
    <>
      <span aria-hidden className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-signal shadow-[0_0_8px_rgba(198,243,107,0.9)]" />
      <span className="sr-only"> (result available)</span>
    </>
  ) : null;
}

/** Desktop navigation with an indicator pill that glides to the active page. */
function DesktopNav({ hasResult }: { hasResult: boolean }) {
  const { pathname } = useLocation();
  const navRef = useRef<HTMLElement>(null);
  const linkRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const [pill, setPill] = useState<{ x: number; w: number } | null>(null);
  // The first placement is instant; only later moves glide.
  const [animated, setAnimated] = useState(false);
  const activeIndex = NAV.findIndex((n) => isActive(n.to, n.end, pathname));

  useLayoutEffect(() => {
    const measure = () => {
      const el = linkRefs.current[activeIndex];
      setPill(el ? { x: el.offsetLeft, w: el.offsetWidth } : null);
    };
    measure();
    const raf = requestAnimationFrame(() => setAnimated(true));
    // Re-measure when web fonts finish loading or the nav resizes.
    const ro = new ResizeObserver(measure);
    if (navRef.current) ro.observe(navRef.current);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [activeIndex]);

  return (
    <nav ref={navRef} aria-label="Primary" className="relative hidden items-center gap-1 md:flex">
      <span
        aria-hidden
        className={cx(
          'absolute inset-y-0 left-0 rounded-full border border-white/[0.06] bg-white/[0.07]',
          animated && 'transition-[transform,width,opacity] duration-500 ease-out-expo',
          !pill && 'opacity-0',
        )}
        style={pill ? { width: pill.w, transform: `translateX(${pill.x}px)` } : undefined}
      />
      {NAV.map((item, i) => (
        <PageNavLink
          key={item.to}
          ref={(el) => (linkRefs.current[i] = el)}
          to={item.to}
          end={item.end}
          className={({ isActive: active }) =>
            cx(
              'relative rounded-full px-4 py-2 text-sm transition-[color,transform] duration-200 active:scale-[0.96]',
              active ? 'text-bone' : 'text-mist hover:text-bone',
            )
          }
        >
          {item.label}
          {item.to === '/results' && <ResultDot show={hasResult && pathname !== '/results'} />}
        </PageNavLink>
      ))}
    </nav>
  );
}

function Header() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const { analysis } = useAnalysis();
  const scrolled = useScrolled();
  const headerRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setOpen(false), [pathname]);

  // Close the mobile menu on Escape or a click outside the header.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onClick = (e: MouseEvent) => !headerRef.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  // The collapsed menu stays mounted for its height animation; keep it out of the tab order.
  useEffect(() => {
    menuRef.current?.toggleAttribute('inert', !open);
  }, [open]);

  return (
    <header
      ref={headerRef}
      className={cx(
        'site-header sticky top-0 z-50 border-b backdrop-blur-xl transition-[background-color,border-color,box-shadow] duration-500 ease-out-expo',
        scrolled || open
          ? 'border-white/[0.07] bg-ink-950/85 shadow-[0_12px_32px_-20px_rgba(0,0,0,0.8)]'
          : 'border-transparent bg-ink-950/40',
      )}
    >
      <div
        aria-hidden
        className="scroll-progress pointer-events-none absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-signal/0 via-signal/70 to-signal"
      />
      <div className="shell flex h-16 items-center md:h-20 justify-between gap-6">
        <PageLink to="/" aria-label="Face-X Detection home" className="rounded-md transition-opacity hover:opacity-90">
          <Logo />
        </PageLink>

        <DesktopNav hasResult={!!analysis} />

        <div className="flex items-center gap-2">
          {/* Balances the logo so the nav stays centred; hidden on the Detect page itself. */}
          <PageLink
            to="/detect"
            className={cx(
              'group hidden h-9 items-center gap-1.5 rounded-full border border-white/15 px-4 text-sm text-bone transition-all duration-200 hover:border-signal/50 hover:bg-signal/[0.06] hover:text-signal active:scale-[0.97] md:inline-flex',
              pathname === '/detect' && 'md:invisible',
            )}
          >
            Analyse an image
            <ArrowRight aria-hidden className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </PageLink>
          <button
            type="button"
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-bone transition hover:border-white/25 active:scale-95 md:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((o) => !o)}
          >
            <Menu aria-hidden className={cx('absolute h-4 w-4 transition-all duration-300', open ? 'rotate-90 scale-50 opacity-0' : 'opacity-100')} />
            <X aria-hidden className={cx('absolute h-4 w-4 transition-all duration-300', open ? 'opacity-100' : '-rotate-90 scale-50 opacity-0')} />
            {!open && analysis && pathname !== '/results' && (
              <span aria-hidden className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-signal" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu: height animates via grid rows; links stagger in when opened. */}
      <div
        ref={menuRef}
        id="mobile-nav"
        className={cx(
          'grid transition-[grid-template-rows] duration-500 ease-out-expo md:hidden',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <nav aria-label="Mobile" className="min-h-0 overflow-hidden">
          <div className="shell border-t hairline pb-5 pt-2">
            {NAV.map((item, i) => (
              <PageNavLink
                key={item.to}
                to={item.to}
                end={item.end}
                style={{ transitionDelay: open ? `${80 + i * 45}ms` : '0ms' }}
                className={({ isActive: active }) =>
                  cx(
                    'flex items-baseline gap-4 border-b border-white/[0.05] py-4 text-xl transition-[opacity,transform,color] duration-500 ease-out-expo',
                    open ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0',
                    active ? 'text-bone' : 'text-mist hover:text-bone',
                  )
                }
              >
                {({ isActive: active }) => (
                  <>
                    <span className={cx('font-mono text-[11px]', active ? 'text-signal' : 'text-ink-500')}>0{i + 1}</span>
                    <span className="display text-[28px]">{item.label}</span>
                    {item.to === '/results' && analysis && pathname !== '/results' && (
                      <span className="ml-auto rounded-full border border-signal/30 bg-signal/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-signal">
                        Ready
                      </span>
                    )}
                  </>
                )}
              </PageNavLink>
            ))}
            <PageLink
              to="/detect"
              style={{ transitionDelay: open ? '280ms' : '0ms' }}
              className={cx(
                'mt-5 flex h-12 items-center justify-center gap-2 rounded-full bg-signal text-[15px] font-medium text-ink-950 transition-[opacity,transform] duration-500 ease-out-expo active:scale-[0.98]',
                open ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0',
              )}
            >
              Analyse an image <ArrowRight aria-hidden className="h-4 w-4" />
            </PageLink>
          </div>
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  const linkClass =
    'group inline-flex items-center gap-1 text-bone/75 transition-colors duration-200 hover:text-signal';
  const underline =
    'bg-gradient-to-r from-signal to-signal bg-[length:0%_1px] bg-left-bottom bg-no-repeat pb-0.5 transition-[background-size] duration-300 group-hover:bg-[length:100%_1px]';
  return (
    <footer className="border-t hairline">
      <div className="shell grid grid-cols-2 gap-10 py-14 md:grid-cols-12">
        <div className="col-span-2 md:col-span-12 lg:col-span-4">
          <Logo size="lg" />
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-mist">
            AI-based image authenticity and deepfake analysis for still images. Results are model outputs, not legal or
            forensic evidence.
          </p>
        </div>
        <div className="col-span-1 md:col-span-3 lg:col-span-2">
          <p className="eyebrow">Navigate</p>
          <ul className="mt-4 space-y-2.5 text-sm">
            {NAV.map((item) => (
              <li key={item.to}>
                <PageLink to={item.to} className={linkClass}>
                  <span className={underline}>{item.label}</span>
                </PageLink>
              </li>
            ))}
          </ul>
        </div>
        <div className="col-span-1 md:col-span-3 lg:col-span-2">
          <p className="eyebrow">System</p>
          <ul className="mt-4 space-y-2.5 text-sm">
            {SYSTEM_LINKS.map((item) => (
              <li key={item.to}>
                <PageLink to={item.to} className={linkClass}>
                  {item.label}
                  <ArrowUpRight
                    aria-hidden
                    className="h-3.5 w-3.5 opacity-50 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:opacity-100"
                  />
                </PageLink>
              </li>
            ))}
          </ul>
        </div>
        <div className="col-span-2 md:col-span-6 lg:col-span-4">
          <p className="eyebrow">Get in touch</p>
          <ul className="mt-4 space-y-3 text-sm">
            {TEAM.map((m) => (
              <li key={m.email}>
                <a href={`mailto:${m.email}`} className="group flex items-start gap-3 rounded-md" aria-label={`Email ${m.name}`}>
                  <Mail
                    aria-hidden
                    className="mt-0.5 h-4 w-4 shrink-0 text-mist transition-colors duration-200 group-hover:text-signal"
                  />
                  <span className="min-w-0">
                    <span className="block text-bone/85 transition-colors group-hover:text-bone">{m.name}</span>
                    <span className="block truncate font-mono text-[11.5px] text-mist transition-colors group-hover:text-signal">
                      {m.email}
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="shell flex flex-col gap-3 border-t hairline py-6 font-mono text-[10.5px] uppercase tracking-[0.16em] text-mist md:flex-row md:items-center md:justify-between">
        <span>Face-X Detection · {new Date().getFullYear()}</span>
        <nav aria-label="Legal" className="flex gap-5">
          <PageLink to="/privacy" className="group transition-colors hover:text-signal">
            <span className={underline}>Privacy Policy</span>
          </PageLink>
          <PageLink to="/terms" className="group transition-colors hover:text-signal">
            <span className={underline}>Terms of Service</span>
          </PageLink>
        </nav>
        <span>Image-only scope · JPEG / PNG / WebP</span>
      </div>
    </footer>
  );
}

export function Layout() {
  const { pathname, hash } = useLocation();
  const lastPath = useRef<string | null>(null);

  // Layout effect: runs inside the view-transition update, before the new page is captured,
  // so the new page is already at the right scroll position when it fades in.
  useLayoutEffect(() => {
    const firstRender = lastPath.current === null;
    const samePage = lastPath.current === pathname;
    lastPath.current = pathname;
    const target = hash ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
    if (target) {
      // Glide within a page; jump when arriving from another page or on first load.
      target.scrollIntoView({ behavior: samePage ? 'smooth' : 'instant', block: 'start' });
    } else if (!samePage && !firstRender) {
      // First render keeps the browser's own scroll restoration (e.g. on reload).
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
  }, [pathname, hash]);

  return (
    <div className="grain flex min-h-screen flex-col overflow-x-clip">
      <a
        href="#main"
        className="sr-only z-[70] rounded-full bg-signal px-4 py-2 text-sm font-medium text-ink-950 focus:not-sr-only focus:fixed focus:left-4 focus:top-3"
      >
        Skip to content
      </a>
      <Header />
      <main id="main" className="flex-1" tabIndex={-1}>
        {/* Fallback page-enter animation for browsers without View Transitions (see index.css). */}
        <div key={pathname} className="page-enter">
          <Outlet />
        </div>
      </main>
      <Footer />
    </div>
  );
}
