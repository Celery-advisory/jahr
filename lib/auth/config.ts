/**
 * Preview mode - skip real auth and inject a dummy CEO profile.
 * Off by default now that real auth + real employees are wired up.
 * Set NEXT_PUBLIC_AUTH_BYPASS=true to temporarily re-enable it locally.
 * Never honoured in production builds, so a stray env var cannot open the app.
 */
export const AUTH_BYPASS =
  process.env.NODE_ENV !== "production" &&
  process.env.NEXT_PUBLIC_AUTH_BYPASS === "true";
