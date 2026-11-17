import { useEffect, useRef, useState } from 'react';
import { ImageUp } from 'lucide-react';

const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');

/**
 * Lets a file be dropped anywhere on the page, or pasted from the clipboard.
 * Always prevents the browser from opening a dropped file; ignores input while `enabled` is false.
 */
export function usePageFileInput(onFile: (file: File) => void, enabled: boolean) {
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);
  const latest = useRef({ onFile, enabled });
  latest.current = { onFile, enabled };

  useEffect(() => {
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current += 1;
      if (latest.current.enabled) setDragging(true);
    };
    const onOver = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = latest.current.enabled ? 'copy' : 'none';
    };
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setDragging(false);
    };
    const onDrop = (e: DragEvent) => {
      depth.current = 0;
      setDragging(false);
      if (!hasFiles(e)) return;
      e.preventDefault();
      const file = e.dataTransfer?.files?.[0];
      if (file && latest.current.enabled) latest.current.onFile(file);
    };
    const onPaste = (e: ClipboardEvent) => {
      if (!latest.current.enabled) return;
      // Don't hijack pastes into text fields. The target can be a non-element (e.g. window).
      const target = e.target;
      if (target instanceof Element && target.closest('input, textarea, [contenteditable="true"]')) return;
      const file = Array.from(e.clipboardData?.files ?? []).find((f) => f.type.startsWith('image/'));
      if (file) {
        e.preventDefault();
        latest.current.onFile(file);
      }
    };

    window.addEventListener('dragenter', onEnter);
    window.addEventListener('dragover', onOver);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('drop', onDrop);
    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('dragenter', onEnter);
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('drop', onDrop);
      window.removeEventListener('paste', onPaste);
    };
  }, []);

  return dragging;
}

/** Full-screen drop target shown while a file is dragged over the page. */
export function PageDropOverlay({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[65] flex animate-fade-up-fast items-center justify-center bg-ink-950/75 p-6 backdrop-blur-sm"
    >
      <div className="flex h-full max-h-[520px] w-full max-w-3xl animate-scale-in flex-col items-center justify-center rounded-3xl border-2 border-dashed border-signal/60 bg-signal/[0.04]">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-signal bg-signal/15 text-signal">
          <ImageUp className="h-8 w-8" strokeWidth={1.5} />
        </span>
        <p className="display mt-6 text-4xl">Drop to load the image</p>
        <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.16em] text-mist">JPG · JPEG · PNG · WebP — max 10 MB</p>
      </div>
    </div>
  );
}
