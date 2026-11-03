import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const rawNext = url.searchParams.get("next") || "/set-password";
  // Resolve and verify the origin (also rejects backslash-based URL tricks).
  const target = new URL(rawNext, url.origin);
  const next = rawNext.startsWith("/") && target.origin === url.origin ? target.pathname + target.search + target.hash : "/set-password";
  if (!code) return NextResponse.redirect(new URL("/login?error=missing_code", url.origin));

  // The SSR client exchanges the PKCE code and stores the session in cookies.
  const jar = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (items) =>
          items.forEach(({ name, value, options }) => jar.set(name, value, options))
      }
    }
  );
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/login?error=invite_failed", url.origin));
  return NextResponse.redirect(new URL(next, url.origin));
}
