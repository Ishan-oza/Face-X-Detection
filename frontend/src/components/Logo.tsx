import { cx } from './ui';

/*
 * Brand assets are transparent PNGs generated from the supplied logo
 * (docs/brand/make_logo_assets.py): the mark is 429×388 and the wordmark
 * ("FACE-X / DETECTION") is 803×203.
 */

export function LogoMark({ className = 'h-11' }: { className?: string }) {
  return (
    <img
      src="/brand/facex-mark.png"
      alt=""
      aria-hidden
      width={429}
      height={388}
      decoding="async"
      draggable={false}
      className={cx('w-auto select-none', className)}
    />
  );
}

export function LogoWordmark({ className = 'h-8' }: { className?: string }) {
  return (
    <img
      src="/brand/facex-wordmark.png"
      alt="Face-X Detection"
      width={803}
      height={203}
      decoding="async"
      draggable={false}
      className={cx('w-auto select-none', className)}
    />
  );
}

/** Mark + wordmark. "md" is the navbar size; "lg" is used in the footer. */
export function Logo({ size = 'md' }: { size?: 'md' | 'lg' }) {
  return (
    <span className="flex items-center gap-3">
      <LogoMark className={size === 'lg' ? 'h-14' : 'h-11 md:h-[52px]'} />
      <LogoWordmark className={size === 'lg' ? 'h-10' : 'h-7 md:h-[34px]'} />
    </span>
  );
}
