export const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const ACCEPT_ATTRIBUTE = '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp';
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

type AcceptedMime = (typeof ACCEPTED_MIME_TYPES)[number];

export interface ValidatedImage {
  file: File;
  mime: AcceptedMime;
  previewUrl: string;
  width: number;
  height: number;
}

export type ValidationResult = { ok: true; image: ValidatedImage } | { ok: false; error: string };

const EXTENSION_MIME: Record<string, AcceptedMime> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

/** Identify the real format from the file's leading bytes, regardless of its name. */
async function sniffMime(file: File): Promise<AcceptedMime | null> {
  const b = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v)) return 'image/png';
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  if (b.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  return null;
}

function decode(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('decode failed'));
    img.src = url;
  });
}

export async function validateImageFile(file: File): Promise<ValidationResult> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const declared = (ACCEPTED_MIME_TYPES as readonly string[]).includes(file.type) ? file.type : EXTENSION_MIME[ext];

  if (!declared) {
    return { ok: false, error: `“${file.name}” isn’t a supported format. Upload a JPEG, PNG or WebP image.` };
  }
  if (file.size === 0) {
    return { ok: false, error: 'This file is empty.' };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, error: `This image is ${formatBytes(file.size)}. The maximum size is 10 MB.` };
  }

  const mime = await sniffMime(file);
  if (!mime) {
    return { ok: false, error: 'The file contents don’t match a JPEG, PNG or WebP image. It may be corrupted or renamed.' };
  }

  const previewUrl = URL.createObjectURL(file);
  try {
    const { width, height } = await decode(previewUrl);
    if (!width || !height) throw new Error('zero size');
    return { ok: true, image: { file, mime, previewUrl, width, height } };
  } catch {
    URL.revokeObjectURL(previewUrl);
    return { ok: false, error: 'Your browser could not decode this image. It may be corrupted.' };
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
