import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { apiAdminContext } from "@/lib/auth";

export async function POST(req: Request) {
  const c = await apiAdminContext();
  if (!c) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254)
    return NextResponse.json({ error: "Geçerli e-posta gir." }, { status: 400 });

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!key || !url) return NextResponse.json({ error: "Supabase sunucu ayarları eksik." }, { status: 500 });

  const site = (process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin).replace(/\/$/, "");
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${site}/auth/confirm?next=/set-password`
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
