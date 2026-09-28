/** @type {import('next').NextConfig} */

// Baseline security headers on every route. The app is fully client-rendered
// but Next still injects inline bootstrap/hydration scripts, so script-src
// needs 'unsafe-inline'; 'unsafe-eval' is only allowed in development because
// the dev server's HMR runtime requires it.
//
// 2026-09-28: connect-src gains the Manager origin WHEN IT IS CONFIGURED. The
// Manager browser logger and the analytics tracker both POST there (and the
// tracker is fetched as a script), and `connect-src 'self'` alone would block
// them silently. Unset => the policy string is byte-identical to before, so the
// integration stays a true no-op when it is not configured. No script-src
// change is needed: the tracker tag is inserted by script, and script-src
// already allows 'self' + the inline bootstrap.
const isDev = process.env.NODE_ENV !== "production";
const managerOrigin = process.env.NEXT_PUBLIC_MANAGER_ENDPOINT;

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}${managerOrigin ? ` ${managerOrigin}` : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
