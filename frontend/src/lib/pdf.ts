import { api } from './api';

async function fetchPdfBlob(path: string): Promise<Blob> {
  const res = await api.get(path, { responseType: 'blob' });
  return res.data as Blob;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

const withDownload = (path: string) => (path.includes('?') ? `${path}&download=1` : `${path}?download=1`);

/**
 * View or download an authenticated PDF endpoint. The endpoint requires a bearer token,
 * so we fetch it as a blob (axios adds the header) rather than navigating to the URL.
 * For "view" we pre-open a tab synchronously to survive mobile popup blockers.
 */
export async function openPdf(path: string, filename: string, mode: 'view' | 'download') {
  if (mode === 'download') {
    triggerDownload(await fetchPdfBlob(withDownload(path)), filename);
    return;
  }
  const win = window.open('', '_blank');
  try {
    const blob = await fetchPdfBlob(path);
    const url = URL.createObjectURL(blob);
    if (win) win.location.href = url;
    else triggerDownload(blob, filename); // popup blocked → fall back to download
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (err) {
    win?.close();
    throw err;
  }
}

export const openInvoicePdf = (invoiceId: string, invoiceNumber: string, mode: 'view' | 'download') =>
  openPdf(`/invoices/${invoiceId}/pdf`, `${invoiceNumber}.pdf`, mode);

/** Fetch the invoice PDF as a File, so it can be shared as a real attachment. */
export async function getInvoicePdfFile(invoiceId: string, invoiceNumber: string): Promise<File> {
  const blob = await fetchPdfBlob(`/invoices/${invoiceId}/pdf`);
  return new File([blob], `${invoiceNumber}.pdf`, { type: 'application/pdf' });
}

/** Whether this browser can share actual files (Web Share API, level 2 — mostly mobile). */
export function canShareFiles(): boolean {
  try {
    const probe = new File([new Blob(['%PDF'], { type: 'application/pdf' })], 'probe.pdf', { type: 'application/pdf' });
    return typeof navigator !== 'undefined' && !!navigator.canShare && navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}
