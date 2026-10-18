import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('animate-spin', className)} />;
}

export function LoadingScreen({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-muted-foreground">
      <Spinner className="h-7 w-7 text-primary" />
      <span className="text-sm">{label}</span>
    </div>
  );
}
