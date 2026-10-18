import { useState } from 'react';
import { Download, X, Share } from 'lucide-react';
import { usePwaInstall } from '@/hooks/usePwaInstall';
import { Button } from '@/components/ui/button';

const DISMISS_KEY = 'mnm_install_dismissed';

/**
 * Surfaces an install affordance when the browser supports it (Android/desktop Chrome/Edge),
 * and shows manual "Add to Home Screen" guidance on iOS Safari, which has no install event.
 */
export function InstallPrompt() {
  const { canInstall, installed, isIos, promptInstall } = usePwaInstall();
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(DISMISS_KEY) === '1');

  if (installed || dismissed) return null;
  if (!canInstall && !isIos) return null;

  const close = () => {
    setDismissed(true);
    sessionStorage.setItem(DISMISS_KEY, '1');
  };

  return (
    <div className="fixed inset-x-3 bottom-[4.75rem] z-40 mx-auto max-w-md rounded-xl border bg-card p-4 shadow-lg md:bottom-4">
      <button onClick={close} className="absolute right-2 top-2 text-muted-foreground" aria-label="Dismiss">
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3 pr-4">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <Download className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold">Install MNM Fashion</p>
          {isIos ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Tap the <Share className="inline h-3 w-3" /> Share button, then “Add to Home Screen”.
            </p>
          ) : (
            <>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Add it to your home screen for a faster, app-like experience.
              </p>
              <Button size="sm" className="mt-2" onClick={() => void promptInstall()}>
                Install app
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
