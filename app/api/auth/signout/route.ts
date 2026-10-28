import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

/**
 * Clears the session and returns to login.
 *
 * This must be a Route Handler: Server Components cannot write cookies, so
 * signing out from a layout leaves the auth cookie in place and the proxy
 * bounces the request straight back to /dashboard.
 */
async function signOutAndRedirect(request: Request) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  await supabase.auth.signOut();

  const response = NextResponse.redirect(new URL("/login", request.url), 303);

  // Belt and braces: drop any Supabase auth cookie the SDK left behind so the
  // proxy cannot see a stale user and redirect back into the app.
  for (const cookie of cookieStore.getAll()) {
    if (cookie.name.startsWith("sb-")) {
      response.cookies.delete(cookie.name);
    }
  }

  return response;
}

/**
 * GET exists for server-side `redirect(SIGN_OUT_PATH)` calls. Refuse it when
 * another site triggered the request (link, image tag) so outsiders cannot
 * log people out.
 */
export async function GET(request: Request) {
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  return signOutAndRedirect(request);
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  return signOutAndRedirect(request);
}
