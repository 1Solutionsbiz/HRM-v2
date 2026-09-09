"use client";

import * as React from "react";
import { Download, Share, X } from "lucide-react";
import { useInstallPrompt } from "@/lib/use-install-prompt";
import { Button } from "@/components/ui/button";

const DISMISSED_KEY = "hrm-install-prompt-dismissed";

/**
 * Surfaces the app's installability, which otherwise depends entirely on a
 * user noticing the browser's own (easy to miss) install affordance. A
 * permanent backup entry point also lives in Settings for anyone who
 * dismisses this. Dismissal here is remembered per-device in localStorage -
 * a lightweight per-viewer convenience, not data that needs to sync
 * anywhere.
 */
export function InstallPromptBanner() {
  const { canInstall, isIos, isInstalled, promptInstall } = useInstallPrompt();
  const [dismissed, setDismissed] = React.useState(true); // default hidden until the effect below decides otherwise

  React.useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading localStorage, unknowable during SSR (see useInstallPrompt for the same pattern)
      setDismissed(localStorage.getItem(DISMISSED_KEY) === "1");
    } catch {
      setDismissed(false);
    }
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
    await promptInstall();
    setDismissed(true);
  }

  if (isInstalled || dismissed) return null;
  if (!isIos && !canInstall) return null;

  return (
    <div className="bg-primary text-primary-foreground flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm">
      {isIos ? (
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
