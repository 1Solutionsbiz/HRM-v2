import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  // Default runtimeCaching treats every cross-origin GET (which, in this
  // app, means every call to hrm-api.<domain> - a different subdomain from
  // the frontend) as NetworkFirst with a 1-hour cache fallback. On a flaky
  // mobile connection that silently serves up to an hour of stale
  // leave/attendance/report data with no indication to the user - caught
  // live 2026-09-11 (an approved leave still showed "pending" on mobile
  // hours later). API reads must always hit the network for real data;
  // extendDefaultRuntimeCaching + reusing the "cross-origin" cacheName
  // overrides just that one default rule, leaving the static-asset/
  // page-shell caching that makes the PWA usable offline untouched.
  extendDefaultRuntimeCaching: true,
  workboxOptions: {
    disableDevLogs: true,
    runtimeCaching: [
      {
        urlPattern: ({ sameOrigin }: { sameOrigin: boolean }) => !sameOrigin,
        handler: "NetworkOnly",
        options: { cacheName: "cross-origin" },
      },
    ],
  },
});

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default withPWA(nextConfig);
