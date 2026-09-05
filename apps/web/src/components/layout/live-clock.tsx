"use client";

import * as React from "react";
import { formatDateShort, formatTime } from "@/lib/format";

/**
 * A ticking clock for the topbar. Rendered with suppressHydrationWarning
 * rather than a mount-guard: unlike the theme toggle, there's no wrong
 * answer to hide - the server's timestamp and the client's first tick are
 * both "correct," just a few hundred ms apart, so a warning would be noise.
 */
export function LiveClock() {
  const [now, setNow] = React.useState(() => new Date());

  React.useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span suppressHydrationWarning className="tabular-nums">
      {formatDateShort(now)} · {formatTime(now)}
    </span>
  );
}
