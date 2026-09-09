import * as React from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return true;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari's own non-standard flag - no matchMedia equivalent there.
    (navigator as { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

/**
 * Shared install-eligibility state for the InstallPromptBanner and the
 * Settings "Install app" entry, so both agree on whether installing is
 * even possible right now instead of each guessing independently.
 */
export function useInstallPrompt() {
  const [installEvent, setInstallEvent] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = React.useState(true); // SSR/first-render-safe default
  const [ios, setIos] = React.useState(false);

  React.useEffect(() => {
    // Browser-only state (matchMedia/UA), unknowable during SSR - defaults
    // above match the server render, this flips them once mounted. Same
    // sanctioned pattern as lib/use-async.ts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInstalled(isStandalone());
    setIos(isIos());

    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    }
    function onAppInstalled() {
      setInstallEvent(null);
      setInstalled(true);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const promptInstall = React.useCallback(async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    setInstallEvent(null);
    if (outcome === "accepted") setInstalled(true);
  }, [installEvent]);

  return {
    /** True once the browser has offered a real one-tap install (Android/Chrome/Edge). */
    canInstall: installEvent !== null,
    /** iOS has no install event - "canInstall" never fires there, show static instructions instead. */
    isIos: ios,
    isInstalled: installed,
    promptInstall,
  };
}
