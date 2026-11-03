import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";

// Davet / şifre sıfırlama bağlantıları buraya gelir (token_hash akışı).
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token_hash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const rawNext = url.searchParams.get("next") || "/set-password";
  // Açık yönlendirmeyi önle; URL ayrıştırması ters eğik çizgi numaralarını da yakalar.
  const target = new URL(rawNext, url.origin);
  const next = rawNext.startsWith("/") && target.origin === url.origin
    ? target.pathname + target.search + target.hash
    : "/set-password";

  if (!token_hash || !type) return NextResponse.redirect(new URL("/login?error=missing_token", url.origin));

  const jar = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (items) => items.forEach(({ name, value, options }) => jar.set(name, value, options))
      }
    }
  );
  const { error } = await supabase.auth.verifyOtp({ type, token_hash });
  if (error) return NextResponse.redirect(new URL("/login?error=invite_failed", url.origin));
  return NextResponse.redirect(new URL(next, url.origin));
}
