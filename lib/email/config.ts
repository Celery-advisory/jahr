/** Public site supervisors and employees open from email. */
const CANONICAL_APP_URL = "https://tms.jagroup.co";

function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, "");
}

function hostnameOf(value: string): string | null {
  try {
    const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    return new URL(withProtocol).hostname;
  } catch {
    return null;
  }
}

/**
 * VERCEL_URL is the unique deployment host (*.vercel.app). That host sits
 * behind Vercel login, so it must not be the link in approval mail.
 */
function isVercelDeploymentHost(value: string): boolean {
  const host = hostnameOf(value);
  return host !== null && host.endsWith(".vercel.app");
}

function explicitAppUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL;
  if (!raw || isVercelDeploymentHost(raw)) return null;
  return stripTrailingSlash(raw);
}

/**
 * Absolute origin for links and assets in transactional email.
 * Deployed mail uses the public TMS domain, never a *.vercel.app host.
 */
export function getAppBaseUrl(): string {
  const explicit = explicitAppUrl();
  if (explicit) return explicit;

  if (process.env.VERCEL_ENV === "production") {
    const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
    if (productionHost && !isVercelDeploymentHost(productionHost)) {
      const host = hostnameOf(productionHost);
      if (host) return `https://${host}`;
    }
    return CANONICAL_APP_URL;
  }

  if (process.env.VERCEL_ENV === "preview" || process.env.NODE_ENV === "production") {
    return CANONICAL_APP_URL;
  }

  return "http://localhost:3000";
}

/** Public Supabase Storage bucket holding brand images used in email. */
export const EMAIL_ASSET_BUCKET = "branding";

/** Objects in EMAIL_ASSET_BUCKET, mirrored by the repo files in the fallbacks below. */
export const EMAIL_ASSET_PATHS = {
  logo: "emails/jalog.png",
  logoWhite: "emails/ja-logo-white.png",
  hands: "emails/hands.jpg",
} as const;

/**
 * Emails cannot reliably load localhost / app-origin assets, so brand images
 * resolve to the public Supabase object URL and only fall back to the app.
 */
function getEmailAssetUrl(storagePath: string, appPath: string): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (supabaseUrl) {
    return `${supabaseUrl}/storage/v1/object/public/${EMAIL_ASSET_BUCKET}/${storagePath}`;
  }
  return `${getAppBaseUrl()}${appPath}`;
}

/** Dark J.A mark for light headers. */
export function getEmailLogoUrl(): string {
  return (
    process.env.EMAIL_LOGO_URL ??
    getEmailAssetUrl(EMAIL_ASSET_PATHS.logo, "/logos/jalog.png")
  );
}

/** White JA Group wordmark for the navy brand band. */
export function getEmailLogoWhiteUrl(): string {
  return (
    process.env.EMAIL_LOGO_WHITE_URL ??
    getEmailAssetUrl(EMAIL_ASSET_PATHS.logoWhite, "/img/email-logo-white.png")
  );
}

/** Cupped-hands photo used in the "Prosper With Purpose" sign-off. */
export function getEmailHandsUrl(): string {
  return (
    process.env.EMAIL_HANDS_URL ??
    getEmailAssetUrl(EMAIL_ASSET_PATHS.hands, "/img/email-hands.jpg")
  );
}

export function getPortalUrl(path = "/"): string {
  const normalised = path.startsWith("/") ? path : `/${path}`;
  return `${getAppBaseUrl()}${normalised}`;
}

export const EMAIL_BRAND = {
  companyName: "JA Group",
  productName: "JA Group TMS",
  tagline: "Prosper With Purpose",
  background: "#F5F7FB",
  surface: "#FFFFFF",
  softSurface: "#FBFCFE",
  secondaryFill: "#EEF2F7",
  border: "#E3E8EF",
  text: "#171717",
  mutedText: "#667085",
  accent: "#0070F3",
  /** JA navy: brand bands and the sign-off block. */
  navy: "#1D1F4F",
  navyBorder: "#31346B",
  /** Text sitting on navy. */
  onNavy: "#FFFFFF",
  onNavyMuted: "#B4B7D6",
  /** Warm gold used for the tagline, matching the JA email signature. */
  gold: "#C9A87C",
  success: "#16A34A",
  warning: "#F59E0B",
  error: "#DC2626",
  footerLine: "JA Group TMS",
  /** Display size for the J.A mark in email headers (source is 300×180). */
  logoWidth: 100,
  logoHeight: 60,
  /** Display size for the white wordmark (source is 360×80). */
  logoWhiteWidth: 120,
  logoWhiteHeight: 27,
  /** Default card width; widens via media query in the email shell. */
  contentWidth: 600,
  contentWidthDesktop: 720,
} as const;

/** Confidentiality notice for Internal Comms / broadcast emails. */
export const EMAIL_CONFIDENTIALITY = {
  body: "This email is intended for internal use within JA Group and may contain confidential information. Please do not share or distribute it outside the organisation without prior authorisation. If you received this email in error, please notify the sender and delete it.",
} as const;
