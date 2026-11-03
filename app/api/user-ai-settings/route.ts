import { NextResponse } from "next/server";
import { z } from "zod";
import { apiContext } from "@/lib/auth";
import { encryptSecret } from "@/lib/secrets";

const schema = z.object({ provider: z.enum(["gemini", "openai"]), model: z.string().trim().min(2).max(100), apiKey: z.string().trim().max(500).optional().default("") });
const defaultModel = (provider: "gemini" | "openai") => provider === "openai" ? "gpt-4.1-mini" : "gemini-3.8-flash";
const extendedColumns = "provider,model,api_key_ciphertext,updated_at,jarvis_provider,gemini_model,gemini_api_key_ciphertext,openai_model,openai_api_key_ciphertext";

export async function GET() {
  const c = await apiContext();
  if (!c) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const full = await c.sb.from("user_ai_settings").select(extendedColumns).eq("user_id", c.user.id).maybeSingle();
  if (full.error) {
    const old = await c.sb.from("user_ai_settings").select("provider,model,api_key_ciphertext,updated_at").eq("user_id", c.user.id).maybeSingle();
    if (old.error) return NextResponse.json({ error: "AI ayarları okunamadı. Supabase migration dosyalarını kontrol et." }, { status: 503 });
    const row = old.data;
    const provider = row?.provider || "openai";
    return NextResponse.json({ provider, model: row?.model || defaultModel(provider), keyConfigured: Boolean(row?.api_key_ciphertext), updatedAt: row?.updated_at || null, dualProviderReady: false, jarvisProvider: provider, providers: { gemini: { model: defaultModel("gemini"), keyConfigured: provider === "gemini" && Boolean(row?.api_key_ciphertext) }, openai: { model: defaultModel("openai"), keyConfigured: provider === "openai" && Boolean(row?.api_key_ciphertext) } }, encryptionReady: /^[a-f0-9]{64}$/i.test(process.env.APP_ENCRYPTION_KEY || "") });
  }
  const row = full.data;
  const provider = row?.provider || "openai";
  const model = row?.model || defaultModel(provider);
  return NextResponse.json({
    provider, model, keyConfigured: Boolean(row?.api_key_ciphertext), updatedAt: row?.updated_at || null,
    dualProviderReady: true, jarvisProvider: row?.jarvis_provider || "openai",
    providers: {
      gemini: { model: row?.gemini_model || (provider === "gemini" ? model : defaultModel("gemini")), keyConfigured: Boolean(row?.gemini_api_key_ciphertext || (provider === "gemini" && row?.api_key_ciphertext)) },
      openai: { model: row?.openai_model || (provider === "openai" ? model : defaultModel("openai")), keyConfigured: Boolean(row?.openai_api_key_ciphertext || (provider === "openai" && row?.api_key_ciphertext)) }
    },
    encryptionReady: /^[a-f0-9]{64}$/i.test(process.env.APP_ENCRYPTION_KEY || "")
  });
}

export async function POST(req: Request) {
  const c = await apiContext();
  if (!c) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Sağlayıcı, model veya API anahtarı geçersiz." }, { status: 400 });
  if (parsed.data.apiKey && /[^\x00-\x7F]/.test(parsed.data.apiKey)) return NextResponse.json({ error: "API anahtarında geçersiz karakter var. Anahtarı sağlayıcı panelinden yeniden kopyala; açıklama veya tırnak işareti ekleme." }, { status: 400 });

  const full = await c.sb.from("user_ai_settings").select(extendedColumns).eq("user_id", c.user.id).maybeSingle();
  const dualProviderReady = !full.error;
  const old = dualProviderReady ? null : await c.sb.from("user_ai_settings").select("provider,model,api_key_ciphertext,updated_at").eq("user_id", c.user.id).maybeSingle();
  if (old?.error) return NextResponse.json({ error: "AI ayarları okunamadı. Supabase migration dosyalarını kontrol et." }, { status: 503 });
  const current: any = dualProviderReady ? full.data : old?.data;
  if (!dualProviderReady && current?.provider && current.provider !== parsed.data.provider) {
    return NextResponse.json({ error: "Gemini ve ChatGPT anahtarlarını ayrı saklamak için Supabase 0008_jarvis_dual_ai_providers.sql migration dosyasını çalıştır." }, { status: 503 });
  }

  let encrypted: string | null = dualProviderReady
    ? (parsed.data.provider === "gemini" ? current?.gemini_api_key_ciphertext : current?.openai_api_key_ciphertext) || (current?.provider === parsed.data.provider ? current?.api_key_ciphertext : null)
    : (current?.provider === parsed.data.provider ? current.api_key_ciphertext : null);
  if (parsed.data.apiKey) {
    try { encrypted = encryptSecret(parsed.data.apiKey); }
    catch { return NextResponse.json({ error: "APP_ENCRYPTION_KEY sunucuda tanımlı değil veya geçersiz." }, { status: 503 }); }
  }
  if (!encrypted) return NextResponse.json({ error: "Önce bu sağlayıcının API anahtarını ekle." }, { status: 400 });

  const now = new Date().toISOString();
  const row: Record<string, unknown> = { user_id: c.user.id, provider: parsed.data.provider, model: parsed.data.model, api_key_ciphertext: encrypted, updated_at: now };
  if (dualProviderReady) {
    row.jarvis_provider = current?.jarvis_provider || "openai";
    row.gemini_model = parsed.data.provider === "gemini" ? parsed.data.model : current?.gemini_model || null;
    row.gemini_api_key_ciphertext = parsed.data.provider === "gemini" ? encrypted : current?.gemini_api_key_ciphertext || null;
    row.openai_model = parsed.data.provider === "openai" ? parsed.data.model : current?.openai_model || null;
    row.openai_api_key_ciphertext = parsed.data.provider === "openai" ? encrypted : current?.openai_api_key_ciphertext || null;
  }
  const { error } = await c.sb.from("user_ai_settings").upsert(row, { onConflict: "user_id" });
  if (error) return NextResponse.json({ error: "Kişisel AI ayarın kaydedilemedi." }, { status: 500 });

  const providers = dualProviderReady ? {
    gemini: { model: row.gemini_model || defaultModel("gemini"), keyConfigured: Boolean(row.gemini_api_key_ciphertext) },
    openai: { model: row.openai_model || defaultModel("openai"), keyConfigured: Boolean(row.openai_api_key_ciphertext) }
  } : { [parsed.data.provider]: { model: parsed.data.model, keyConfigured: true } };
  return NextResponse.json({ ok: true, provider: parsed.data.provider, model: parsed.data.model, keyConfigured: true, dualProviderReady, jarvisProvider: dualProviderReady ? row.jarvis_provider : parsed.data.provider, providers });
}
