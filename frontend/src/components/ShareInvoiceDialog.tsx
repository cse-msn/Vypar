import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { MessageCircle, Copy, Share2, FileText, Download, Phone, Send } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Spinner } from '@/components/ui/spinner';
import { fetchInvoiceShare } from '@/hooks/invoices';
import { openInvoicePdf, getInvoicePdfFile } from '@/lib/pdf';
import { getApiError } from '@/lib/api';

// Phones expose WhatsApp (and other apps) in the native file-share sheet; desktops don't,
// so the PDF has to be attached by hand there. Treat touch-first devices as "mobile".
const IS_MOBILE =
  typeof navigator !== 'undefined' &&
  (/android|iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (/Mac/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)); // iPadOS reports as "Mac"

export function ShareInvoiceDialog({
  invoiceId,
  invoiceNumber,
  open,
  onOpenChange,
}: {
  invoiceId: string;
  invoiceNumber: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { data: share, isLoading, isError, error } = useQuery({
    queryKey: ['invoice-share', invoiceId],
    queryFn: () => fetchInvoiceShare(invoiceId),
    enabled: open,
  });

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };

  const nativeShare = async () => {
    if (!share) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: `Invoice ${invoiceNumber}`, text: share.message, url: share.publicUrl });
      } catch {
        /* user cancelled */
      }
    } else {
      await copy(share.publicUrl, 'Link');
    }
  };

  const [sharingPdf, setSharingPdf] = useState(false);
  const sharePdf = async () => {
    setSharingPdf(true);
    try {
      // Phone: the native sheet lists WhatsApp with the PDF already attached — one tap to send.
      if (IS_MOBILE) {
        const file = await getInvoicePdfFile(invoiceId, invoiceNumber);
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: `Invoice ${invoiceNumber}`, text: share?.pdfMessage });
          return;
        }
      }
      // Desktop: WhatsApp Web can't be handed a file by the browser, so download the PDF and
      // open the chat with just the amount summary (no link) — then drag the file into the chat.
      await openInvoicePdf(invoiceId, invoiceNumber, 'download');
      if (share?.pdfWhatsappUrl) window.open(share.pdfWhatsappUrl, '_blank', 'noopener,noreferrer');
      toast.success('PDF downloaded — WhatsApp opened', {
        description: 'Drag the downloaded PDF into the chat (or tap 📎 → Document), then send.',
      });
    } catch (e) {
      if ((e as Error).name !== 'AbortError') toast.error(getApiError(e).message);
    } finally {
      setSharingPdf(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share invoice {invoiceNumber}</DialogTitle>
          <DialogDescription>
            {IS_MOBILE
              ? 'Send the PDF: tap “Share PDF to WhatsApp”, pick WhatsApp, then send. “Open WhatsApp (link)” sends a text link instead.'
              : 'On a computer WhatsApp can’t be handed a file automatically. “Send PDF on WhatsApp” downloads the bill and opens the customer’s chat with the amount summary — drag the PDF in and send. “Open WhatsApp (link)” sends the bill link instead.'}
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Spinner className="h-6 w-6 text-primary" />
          </div>
        )}

        {isError && <p className="text-sm text-destructive">{getApiError(error).message}</p>}

        {share && (
          <div className="space-y-4">
            {!share.hasNumber && (
              <div className="flex items-start gap-2 rounded-lg bg-warning/10 p-3 text-xs text-warning">
                <Phone className="mt-0.5 h-4 w-4 shrink-0" />
                No valid WhatsApp number on file — WhatsApp will open so you can choose a contact.
              </div>
            )}

            <Textarea readOnly value={share.message} className="h-32 text-sm" />

            <div className="grid grid-cols-1 gap-2">
              <Button size="lg" onClick={sharePdf} disabled={sharingPdf}>
                {sharingPdf ? <Spinner className="h-5 w-5" /> : <Send className="h-5 w-5" />}{' '}
                {IS_MOBILE ? 'Share PDF to WhatsApp' : 'Send PDF on WhatsApp'}
              </Button>
              {!IS_MOBILE && (
                <p className="-mt-1 text-xs text-muted-foreground">
                  Downloads the PDF and opens WhatsApp — drag the file into the chat, then send. For one-tap
                  sending with the PDF already attached, open this app on your phone.
                </p>
              )}
              <Button asChild size="lg" variant="success">
                <a href={share.whatsappUrl} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="h-5 w-5" /> Open WhatsApp (link)
                </a>
              </Button>

              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={nativeShare}>
                  <Share2 className="h-4 w-4" /> Share…
                </Button>
                <Button variant="outline" onClick={() => copy(share.publicUrl, 'Link')}>
                  <Copy className="h-4 w-4" /> Copy link
                </Button>
                <Button variant="outline" onClick={() => void openInvoicePdf(invoiceId, invoiceNumber, 'view')}>
                  <FileText className="h-4 w-4" /> View PDF
                </Button>
                <Button variant="outline" onClick={() => void openInvoicePdf(invoiceId, invoiceNumber, 'download')}>
                  <Download className="h-4 w-4" /> Download
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
