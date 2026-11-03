import { NextResponse } from "next/server";
import { z } from "zod";
import { apiAdminContext } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { encryptSecret } from "@/lib/secrets";

const schema = z.object({
  provider: z.enum(["gemini", "openai"]),
  model: z.string().trim().min(2).max(100),
  apiKey: z.string().max(500).optional().default("")
});

export async function GET() {
  const c = await apiAdminContext();
  if (!c) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: "Vercel ortam değişkenlerinde SUPABASE_SERVICE_ROLE_KEY eksik." }, { status: 503 });

  const a = supabaseAdmin();
  const { data } = await a.from("platform_ai_settings").select("provider,model,api_key_ciphertext,updated_at").eq("id", "default").maybeSingle();
  const provider = data?.provider || (process.env.AI_PROVIDER === "openai" ? "openai" : "gemini");
  const envKey = provider === "openai" ? process.env.OPENAI_API_KEY : process.env.GEMINI_API_KEY;
  return NextResponse.json({
    provider,
    model: data?.model || (provider === "openai" ? process.env.OPENAI_MODEL || "gpt-4.1-mini" : process.env.GEMINI_MODEL || "gemini-2.5-flash"),
    keyConfigured: Boolean(data?.api_key_ciphertext || envKey),
    encryptionReady: /^[a-f0-9]{64}$/i.test(process.env.APP_ENCRYPTION_KEY || ""),
    keySource: data?.api_key_ciphertext ? "dashboard" : envKey ? "vercel" : "missing",
    updatedAt: data?.updated_at || null
  });
}

export async function POST(req: Request) {
  const c = await apiAdminContext();
  if (!c) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: "Vercel ortam değişkenlerinde SUPABASE_SERVICE_ROLE_KEY eksik." }, { status: 503 });
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Sağlayıcı, model veya API anahtarı geçersiz." }, { status: 400 });

  const a = supabaseAdmin();
  const { data: current } = await a.from("platform_ai_settings").select("provider,api_key_ciphertext").eq("id", "default").maybeSingle();
  const suppliedKey = p.data.apiKey.trim();
  let encrypted = current?.provider === p.data.provider ? current.api_key_ciphertext : null;
  if (suppliedKey) {
    try { encrypted = encryptSecret(suppliedKey); }
    catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Şifreleme yapılandırması eksik." }, { status: 500 }); }
  }
  const envKey = p.data.provider === "openai" ? process.env.OPENAI_API_KEY : process.env.GEMINI_API_KEY;
  if (!encrypted && !envKey) {
    return NextResponse.json({ error: "Bu sağlayıcı için API anahtarı girmen gerekiyor." }, { status: 400 });
  }
  const { error } = await a.from("platform_ai_settings").upsert({
    id: "default", provider: p.data.provider, model: p.data.model,
    api_key_ciphertext: encrypted, updated_by: c.user.id, updated_at: new Date().toISOString()
  }, { onConflict: "id" });
  if (error) {
    console.error("AI settings save failed", error);
    return NextResponse.json({ error: "Ayarlar kaydedilemedi. Supabase 0005 migration dosyasını çalıştırdığını kontrol et." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, keyConfigured: Boolean(encrypted || envKey) });
}
