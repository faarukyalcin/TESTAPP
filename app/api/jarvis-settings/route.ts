import { NextResponse } from "next/server";
import { z } from "zod";
import { apiContext } from "@/lib/auth";
import { getAIConfig } from "@/lib/ai";

const providerSchema = z.object({ provider: z.enum(["gemini", "openai"]) });

export async function GET() {
  const c = await apiContext();
  if (!c) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await c.sb.from("user_ai_settings")
    .select("provider,jarvis_provider,gemini_api_key_ciphertext,openai_api_key_ciphertext,api_key_ciphertext")
    .eq("user_id", c.user.id).maybeSingle();
  if (error) {
    const legacy = await c.sb.from("user_ai_settings").select("provider,api_key_ciphertext").eq("user_id", c.user.id).maybeSingle();
    if (legacy.error) return NextResponse.json({ error: "AI ayarları okunamadı." }, { status: 503 });
    const active = legacy.data?.provider || "openai";
    return NextResponse.json({ jarvisProvider: active, dualProviderReady: false, providers: { gemini: active === "gemini" && Boolean(legacy.data?.api_key_ciphertext), openai: active === "openai" && Boolean(legacy.data?.api_key_ciphertext) } });
  }
  const [gemini, openai] = await Promise.all([
    getAIConfig(c.user.id, c.sb, "gemini").then(() => true).catch(() => false),
    getAIConfig(c.user.id, c.sb, "openai").then(() => true).catch(() => false)
  ]);
  return NextResponse.json({ jarvisProvider: data?.jarvis_provider || "openai", dualProviderReady: true, providers: { gemini, openai } });
}

export async function POST(req: Request) {
  const c = await apiContext();
  if (!c) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = providerSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Jarvis sağlayıcısı geçersiz." }, { status: 400 });
  try { await getAIConfig(c.user.id, c.sb, parsed.data.provider); }
  catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Bu sağlayıcı için API anahtarı ayarlı değil." }, { status: 400 });
  }
  const { error } = await c.sb.from("user_ai_settings").update({ jarvis_provider: parsed.data.provider, updated_at: new Date().toISOString() }).eq("user_id", c.user.id);
  if (error) return NextResponse.json({ error: "Jarvis sağlayıcısı değiştirilemedi. Supabase 0008_jarvis_dual_ai_providers.sql migration dosyasını çalıştır." }, { status: 503 });
  return NextResponse.json({ ok: true, provider: parsed.data.provider });
}
