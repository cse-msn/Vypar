/** Minimal mime helpers for product media + PDFs (no external dependency). */
const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  pdf: 'application/pdf',
};

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'application/pdf': 'pdf',
};

/** Allowed upload content types (images + short videos). */
export const ALLOWED_UPLOAD_MIME = new Set(Object.keys(MIME_TO_EXT).filter((m) => m !== 'application/pdf'));

export function mimeToExt(mime: string): string | undefined {
  return MIME_TO_EXT[mime];
}

export function extToMime(fileOrExt: string): string {
  const ext = fileOrExt.replace(/^.*\./, '').toLowerCase();
  return EXT_TO_MIME[ext] ?? 'application/octet-stream';
}

export function isVideoMime(mime: string): boolean {
  return mime.startsWith('video/');
}
