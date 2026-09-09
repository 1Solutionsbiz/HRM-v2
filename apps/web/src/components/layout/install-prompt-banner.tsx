"use client";

import * as React from "react";
import { Download, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const DISMISSED_KEY = "hrm-install-prompt-dismissed";

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
 * Surfaces the app's installability, which otherwise depends entirely on a
 * user noticing the browser's own (easy to miss) install affordance.
 * Android/Chrome/Edge get a real one-tap install via `beforeinstallprompt`;
 * iOS Safari has no such API, so it gets static "Share -> Add to Home
 * Screen" instructions instead. Dismissal is remembered per-device in
 * localStorage - this is a lightweight per-viewer convenience, not data
 * that needs to sync anywhere.
 */
export function InstallPromptBanner() {
  const [installEvent, setInstallEvent] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [showIosInstructions, setShowIosInstructions] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(true); // default hidden until effects decide otherwise

  React.useEffect(() => {
    if (isStandalone()) return;
    try {
      if (localStorage.getItem(DISMISSED_KEY) === "1") return;
    } catch {
      // Private browsing / storage blocked - fall through and just show it.
    }
    // Reading browser-only state (localStorage/matchMedia/UA) that isn't
    // known during SSR - `dismissed` must default true on the server and
    // first client render alike to avoid a hydration mismatch, then flip
    // here once mounted. Same sanctioned pattern as the effects in
    // lib/use-async.ts and operating-expenses-card.tsx.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissed(false);

    if (isIos()) {
      setShowIosInstructions(true);
      return;
    }

    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    }
    function onAppInstalled() {
      setInstallEvent(null);
      setDismissed(true);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Best-effort - worst case it shows again next visit.
    }
  }

  async function handleInstall() {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    setInstallEvent(null);
    if (outcome === "accepted") setDismissed(true);
  }

  if (dismissed) return null;
  if (!showIosInstructions && !installEvent) return null;

  return (
    <div className="bg-primary text-primary-foreground flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm">
      {showIosInstructions ? (
        <>
          <Share className="size-4 shrink-0" />
          <span className="min-w-0 flex-1">
            Install this app: tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>.
          </span>
        </>
      ) : (
        <>
          <Download className="size-4 shrink-0" />
          <span className="min-w-0 flex-1">Install the HRM app for quicker access.</span>
          <Button size="sm" variant="secondary" className="h-7 shrink-0" onClick={handleInstall}>
            Install
          </Button>
        </>
      )}
      <Button
        size="icon"
        variant="ghost"
        className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground size-7 shrink-0"
        aria-label="Dismiss"
        onClick={dismiss}
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}
