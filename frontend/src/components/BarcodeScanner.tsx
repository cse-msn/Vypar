import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';
import { Keyboard, Camera } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

/** Turn a getUserMedia / zxing failure into a message that tells the user what to do. */
function describeCameraError(e: unknown): string {
  const name = (e as { name?: string })?.name;
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Camera permission is blocked. Allow camera access in your browser settings, then reopen the scanner — or type the code below.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'No camera was found on this device. Type the code below instead.';
    case 'NotReadableError':
    case 'AbortError':
      return 'The camera is busy in another app or tab. Close it and try again — or type the code below.';
    default:
      return 'Camera unavailable. Grant camera permission over HTTPS, or type the code below.';
  }
}

/**
 * Camera barcode scanner with a manual-entry fallback. Camera support varies by
 * browser/OS (needs HTTPS + permission), so the typed fallback always works.
 */
export function BarcodeScanner({
  open,
  onOpenChange,
  onDetected,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDetected: (code: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState('');

  useEffect(() => {
    if (!open) return;
    let active = true;
    setError(null);

    // Pre-flight: the camera APIs only exist in a secure context (HTTPS or localhost).
    // Over the LAN on a phone (http://192.168.x.x) mediaDevices is undefined, so say so
    // clearly instead of letting it fail as a generic "camera unavailable".
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError(
        'Camera needs a secure connection. Open this app over HTTPS or on localhost — ' +
          'phones on the shop Wi-Fi can’t use the camera over a plain http:// address. ' +
          'You can type the code below instead.',
      );
      return;
    }

    const reader = new BrowserMultiFormatReader();

    (async () => {
      try {
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: 'environment' } },
          videoRef.current!,
          (result, _err, ctrl) => {
            if (result && active) {
              ctrl.stop();
              onDetected(result.getText());
              onOpenChange(false);
            }
          },
        );
        controlsRef.current = controls;
        // If the dialog was closed while the camera was starting up, stop it now —
        // otherwise the stream (and the device's camera light) stays on.
        if (!active) {
          controls.stop();
          controlsRef.current = null;
        }
      } catch (e) {
        if (active) setError(describeCameraError(e));
      }
    })();

    return () => {
      active = false;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [open, onDetected, onOpenChange]);

  const submitManual = () => {
    const code = manual.trim();
    if (!code) return;
    onDetected(code);
    setManual('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" /> Scan barcode
          </DialogTitle>
          <DialogDescription>Point the camera at a product barcode.</DialogDescription>
        </DialogHeader>

        <div className="overflow-hidden rounded-lg border bg-black">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
            <Keyboard className="h-4 w-4" /> Or enter code / design number
          </label>
          <div className="flex gap-2">
            <Input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="e.g. D104-RED-36"
              onKeyDown={(e) => e.key === 'Enter' && submitManual()}
            />
            <Button onClick={submitManual}>Go</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
