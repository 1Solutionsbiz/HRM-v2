# Legacy HRM — PWA / Mobile Audit

Source: `1Solutionsbiz/HRM`, commit `4825d04` (2026-06-09).

## Finding: there is no PWA

Checked for and found **none** of:
- `manifest.json` / web app manifest (any name/location)
- A service worker file (`sw.js`, `service-worker.js`, or any `navigator.serviceWorker.register(...)` call)
- `<meta name="apple-touch-icon">`, `<meta name="theme-color">`, or any other PWA-related `<meta>` tag in the shared layout files (`layouts/head-main.php`, `layouts/title-meta.php`, `layouts/head-css.php`)
- Any app-shell / offline-caching strategy
- Any native wrapper (Cordova/Capacitor/React Native) or app-store presence referenced in the repo

## What "mobile" means in the legacy app today

The application is a traditional server-rendered PHP + Bootstrap 5 admin theme. "Mobile support"
is entirely Bootstrap's responsive grid/breakpoints — the same HTML is served to every device,
and it reflows via CSS. There is no distinct mobile experience, no installability, no offline
capability, and no push notification support (the in-app "notifications" feature —
`hrm_notification`, `notification_header.php` — is a database-backed in-app notification list
rendered on page load, not a browser/OS push notification; there is no service worker to receive
push events even if a push backend existed).

The `device_info` table (see `legacy-database-inventory.md`) captures device fingerprint, screen
resolution, platform, timezone, CPU/RAM from the client on login — this is device *analytics*,
not part of any PWA capability (no manifest/service-worker consumes this data).

## Implication for HRM V2

There is nothing to migrate here — no service worker logic, no cached routes, no manifest
config, no installed-user base to preserve compatibility for (since the app was never
installable as a PWA, there's no existing "installed app" icon/behavior on any employee's home
screen to avoid breaking). PWA support in V2 (`apps/web`, `@ducanh2912/next-pwa`, scaffolded
separately) can be designed fresh against actual requirements rather than reconciled against
legacy behavior.

One thing worth carrying forward as a *requirement*, not a technical constraint: whatever the
`device_info` capture was for (likely fraud/anomaly detection on login, given it's stored
alongside `hrm_login_logs`) should be re-scoped deliberately in V2 rather than reproduced
as-is — collecting full device fingerprints (CPU cores, RAM, screen resolution) on every login
is a meaningful amount of client telemetry for an internal HR tool, and its actual purpose was
not confirmed in this pass. Flagged **UNKNOWN** — ask the business owner what this data was
used for before deciding whether V2 needs an equivalent.
