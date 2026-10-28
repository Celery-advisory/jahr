import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { LoginOtpEmail } from "@/emails/login-otp";
import { sendEmail } from "@/lib/email/resend";
import { createAdminClient } from "@/utils/supabase/admin";

const OTP_LENGTH = 6;
const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

export type OtpResult =
  | { ok: true }
  | { ok: false; error: string; status?: number };

/**
 * Generic outcome for unknown, inactive, and wrong-code cases so responses
 * never reveal which emails have accounts.
 */
const INVALID_CODE_ERROR = "Invalid or expired code. Request a new one.";

function otpPepper(): string {
  const secret = process.env.AUTH_OTP_SECRET;
  if (!secret) {
    throw new Error("AUTH_OTP_SECRET is not set.");
  }
  return secret;
}

export function hashOtp(email: string, code: string): string {
  return createHash("sha256")
    .update(`${otpPepper()}:${email.trim().toLowerCase()}:${code}`)
    .digest("hex");
}

function generateOtpCode(): string {
  const max = 10 ** OTP_LENGTH;
  return String(randomInt(0, max)).padStart(OTP_LENGTH, "0");
}

function codesMatch(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

export async function issueLoginOtp(emailInput: string): Promise<OtpResult> {
  const email = emailInput.trim().toLowerCase();

  if (!email || !email.includes("@")) {
    return { ok: false, error: "Enter a valid work email.", status: 400 };
  }

  const admin = createAdminClient();

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, email, status, first_name, preferred_name")
    .eq("email", email)
    .maybeSingle();

  if (profileError) {
    return { ok: false, error: profileError.message, status: 500 };
  }

  // Same response as a real send, so the form cannot be used to probe accounts.
  if (!profile || profile.status !== "active") {
    return { ok: true };
  }

  const { data: latest } = await admin
    .from("login_otps")
    .select("created_at")
    .eq("email", email)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latest?.created_at) {
    const age = Date.now() - new Date(latest.created_at).getTime();
    if (age < RESEND_COOLDOWN_MS) {
      const waitSeconds = Math.ceil((RESEND_COOLDOWN_MS - age) / 1000);
      return {
        ok: false,
        error: `Wait ${waitSeconds}s before requesting another code.`,
        status: 429,
      };
    }
  }

  const code = generateOtpCode();
  const codeHash = hashOtp(email, code);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

  // Invalidate previous unused codes for this email
  await admin
    .from("login_otps")
    .update({ consumed_at: new Date().toISOString() })
    .eq("email", email)
    .is("consumed_at", null);

  const { error: insertError } = await admin.from("login_otps").insert({
    email,
    code_hash: codeHash,
    expires_at: expiresAt,
  });

  if (insertError) {
    return { ok: false, error: insertError.message, status: 500 };
  }

  const displayName =
    profile.preferred_name?.trim() ||
    profile.first_name?.trim() ||
    "there";

  await sendEmail({
    to: email,
    subject: `${code} is your JA Group TMS sign-in code`,
    text: [
      `Hi ${displayName},`,
      "",
      `Your one-time sign-in code is: ${code}`,
      "",
      "It expires in 10 minutes. If you didn’t request this, you can ignore this email.",
    ].join("\n"),
    react: LoginOtpEmail({
      displayName,
      code,
      expiresInMinutes: 10,
    }),
  });

  return { ok: true };
}

export type VerifyOtpResult =
  | { ok: true; userId: string }
  | { ok: false; error: string; status?: number };

export async function verifyLoginOtpCode(
  emailInput: string,
  codeInput: string,
): Promise<VerifyOtpResult> {
  const email = emailInput.trim().toLowerCase();
  const code = codeInput.trim();

  if (!email || !code) {
    return {
      ok: false,
      error: "Enter your email and code.",
      status: 400,
    };
  }

  const admin = createAdminClient();

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, status")
    .eq("email", email)
    .maybeSingle();

  if (profileError) {
    return { ok: false, error: profileError.message, status: 500 };
  }

  if (!profile || profile.status !== "active") {
    return { ok: false, error: INVALID_CODE_ERROR, status: 401 };
  }

  const { data: otpRow, error: otpError } = await admin
    .from("login_otps")
    .select("id, code_hash, expires_at, attempts, consumed_at")
    .eq("email", email)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (otpError) {
    return { ok: false, error: otpError.message, status: 500 };
  }

  if (!otpRow) {
    return { ok: false, error: INVALID_CODE_ERROR, status: 401 };
  }

  if (new Date(otpRow.expires_at).getTime() < Date.now()) {
    await admin
      .from("login_otps")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", otpRow.id);
    return {
      ok: false,
      error: "That code has expired. Request a new one.",
      status: 400,
    };
  }

  if (otpRow.attempts >= MAX_ATTEMPTS) {
    await admin
      .from("login_otps")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", otpRow.id);
    return {
      ok: false,
      error: "Too many attempts. Request a new code.",
      status: 429,
    };
  }

  // Claim this attempt before checking the code. The update only matches if
  // nobody else bumped the counter since we read it, so concurrent guesses
  // cannot all slip through on the same count.
  const { data: claimed } = await admin
    .from("login_otps")
    .update({ attempts: otpRow.attempts + 1 })
    .eq("id", otpRow.id)
    .eq("attempts", otpRow.attempts)
    .is("consumed_at", null)
    .select("id");

  if (!claimed?.length) {
    return {
      ok: false,
      error: "Too many attempts at once. Try again.",
      status: 429,
    };
  }

  if (!codesMatch(otpRow.code_hash, hashOtp(email, code))) {
    return { ok: false, error: "Invalid verification code.", status: 401 };
  }

  // Single use: only the first request to consume the row wins.
  const { data: consumed } = await admin
    .from("login_otps")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", otpRow.id)
    .is("consumed_at", null)
    .select("id");

  if (!consumed?.length) {
    return { ok: false, error: INVALID_CODE_ERROR, status: 401 };
  }

  return { ok: true, userId: profile.id };
}

/**
 * After our OTP succeeds, return a one-time token_hash the cookie-bound
 * Supabase client can exchange via verifyOtp - so session cookies are written
 * through @supabase/ssr the way Next expects.
 */
export async function createSessionTokenHash(
  email: string,
): Promise<{ ok: true; tokenHash: string } | { ok: false; error: string }> {
  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: email.trim().toLowerCase(),
  });

  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) {
    return {
      ok: false,
      error: error?.message ?? "Could not create a session.",
    };
  }

  return { ok: true, tokenHash };
}
