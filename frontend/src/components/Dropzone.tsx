import { useRef } from 'react';
import { ClipboardPaste, ImageUp } from 'lucide-react';
import { ACCEPT_ATTRIBUTE } from '../lib/imageValidation';
import { cx } from './ui';

interface DropzoneProps {
  onFile: (file: File) => void;
  disabled?: boolean;
  /** True while the file is being validated. */
  busy?: boolean;
  /** True while a file is being dragged over the page (drops are handled page-wide). */
  dragging?: boolean;
}

/** Click-to-browse upload target. Drag-and-drop and paste are handled by the page (see PageFileDrop). */
export function Dropzone({ onFile, disabled, busy, dragging }: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        aria-describedby="dropzone-hint"
        className={cx(
          // Large screens: height follows the viewport so the whole zone is visible on arrival.
          'group relative flex aspect-[4/3] w-full flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed text-center transition-all duration-300 ease-out active:scale-[0.995] sm:aspect-[16/10] lg:aspect-auto lg:h-[clamp(320px,calc(100svh-22rem),500px)]',
          dragging
            ? 'border-signal bg-signal/[0.06]'
            : 'border-white/15 bg-ink-900/60 hover:border-signal/40 hover:bg-ink-900',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        <div aria-hidden className="bg-grid mask-radial absolute inset-0 opacity-70" />
        {/* Corner ticks that tighten on hover, echoing the specimen frame. */}
        {['left-4 top-4 border-l border-t', 'right-4 top-4 border-r border-t', 'bottom-4 left-4 border-b border-l', 'bottom-4 right-4 border-b border-r'].map(
          (pos) => (
            <span
              key={pos}
              aria-hidden
              className={cx(
                'absolute h-4 w-4 border-bone/30 transition-all duration-500 ease-out-expo group-hover:border-signal/70',
                pos,
                'group-hover:scale-90',
              )}
            />
          ),
        )}
        <div
          className={cx(
            'relative flex h-16 w-16 items-center justify-center rounded-2xl border transition-all duration-500 ease-out-expo',
            dragging
              ? 'scale-110 border-signal bg-signal/15 text-signal'
              : 'border-white/10 bg-ink-800 text-bone group-hover:-translate-y-1 group-hover:border-signal/40 group-hover:text-signal',
          )}
        >
          {busy ? (
            <span aria-hidden className="h-6 w-6 animate-spin rounded-full border-2 border-signal/30 border-t-signal" />
          ) : (
            <ImageUp aria-hidden className="h-7 w-7" strokeWidth={1.5} />
          )}
        </div>
        <p className="display relative mt-6 px-6 text-3xl sm:text-4xl">
          {busy ? 'Checking the image…' : dragging ? 'Release to load' : 'Drop an image to examine'}
        </p>
        <p className="relative mt-3 text-sm text-mist">
          or <span className="text-bone underline decoration-signal/60 underline-offset-4">browse your files</span>
          <span className="hidden md:inline">
            {' '}
            · <ClipboardPaste aria-hidden className="mb-0.5 inline h-3.5 w-3.5" /> paste with Ctrl + V
          </span>
        </p>
        <p id="dropzone-hint" className="relative mt-6 font-mono text-[10.5px] uppercase tracking-[0.16em] text-mist">
          JPG · JPEG · PNG · WebP — max 10 MB
        </p>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}
