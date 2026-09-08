"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

/**
 * A single-click light/dark toggle for the topbar. The icon shown is the
 * action a click takes (Moon in light mode = "go dark"), not the current
 * state. Full control (including "System") stays in Settings.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // Avoid a hydration mismatch: resolvedTheme is only known after mount
  // (before that we don't know the system preference the server used).
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time mount detection, the standard next-themes pattern, not derived state
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" disabled aria-label="Toggle theme" className={className}>
        <Sun />
      </Button>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={className}
    >
      {isDark ? <Sun /> : <Moon />}
    </Button>
  );
}
