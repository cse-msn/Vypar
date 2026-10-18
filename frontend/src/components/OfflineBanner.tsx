import { WifiOff } from 'lucide-react';
import { useOnline } from '@/hooks/useOnline';

/** Persistent, unmissable notice while offline — inventory actions are paused. */
export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div className="sticky top-0 z-40 flex items-center justify-center gap-2 bg-warning px-3 py-1.5 text-center text-xs font-medium text-warning-foreground">
      <WifiOff className="h-3.5 w-3.5" />
      <span>You're offline — showing cached data. Billing &amp; stock updates are paused until you reconnect.</span>
    </div>
  );
}
