import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Safe update handling: when a new service worker is waiting, we show a banner and let
 * the user choose when to reload — an update never interrupts an in-progress bill.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, r) {
      // Periodically check for a new version (every 30 min) while the app stays open.
      if (r)
        setInterval(() => {
          void r.update();
        }, 30 * 60 * 1000);
    },
  });

  if (!needRefresh) return null;

  return (
    <div className="fixed inset-x-3 bottom-[4.75rem] z-50 mx-auto flex max-w-md items-center gap-3 rounded-xl border bg-card p-3 shadow-lg md:bottom-4">
      <RefreshCw className="h-5 w-5 text-primary" />
      <div className="flex-1 text-sm">
        <p className="font-semibold">Update available</p>
        <p className="text-xs text-muted-foreground">A new version is ready to install.</p>
      </div>
      <Button size="sm" variant="ghost" onClick={() => setNeedRefresh(false)}>
        Later
      </Button>
      <Button size="sm" onClick={() => void updateServiceWorker(true)}>
        Reload
      </Button>
    </div>
  );
}
