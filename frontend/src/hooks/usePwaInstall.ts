import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Captures the browser's install prompt where supported (Android Chrome, desktop Chrome/Edge).
 * iOS Safari does not fire this event — the UI falls back to "Add to Home Screen" guidance.
 */
export function usePwaInstall() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(
    () => window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true,
  );

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(navigator as any).standalone;

  const promptInstall = async () => {
    if (!deferred) return false;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === 'accepted') setDeferred(null);
    return choice.outcome === 'accepted';
  };

  return {
    canInstall: !!deferred,
    installed,
    isIos,
    promptInstall,
  };
}
