import { NextResponse } from "next/server";
import { z } from "zod";
import { apiContext } from "@/lib/auth";
import { encryptSecret } from "@/lib/secrets";

const schema = z.object({
  provider: z.enum(["gemini", "openai"]),
  model: z.string().trim().min(2).max(100),
  apiKey: z.string().trim().max(500).optional().default("")
});

export async function GET() {
  const c = await apiContext();
  if (!c) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await c.sb.from("user_ai_settings")
    .select("provider,model,api_key_ciphertext,updated_at")
    .eq("user_id", c.user.id).maybeSingle();
  if (error) return NextResponse.json({ error: "Kişisel AI ayarları okunamadı. Supabase 0007 migration dosyasını çalıştır." }, { status: 503 });
  let model = data?.model || "gemini-3.8-flash";
  if (data?.provider === "gemini" && model === "gemini-2.5-flash") {
    model = "gemini-3.8-flash";
    await c.sb.from("user_ai_settings").update({ model, updated_at: new Date().toISOString() }).eq("user_id", c.user.id);
  }
  return NextResponse.json({
    provider: data?.provider || "gemini",
    model,
    keyConfigured: Boolean(data?.api_key_ciphertext),
    keySource: data?.api_key_ciphertext ? "dashboard" : "missing",
    encryptionReady: /^[a-f0-9]{64}$/i.test(process.env.APP_ENCRYPTION_KEY || ""),
    updatedAt: data?.updated_at || null
  });
}

export async function POST(req: Request) {
  const c = await apiContext();
  if (!c) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Sağlayıcı, model veya API anahtarı geçersiz." }, { status: 400 });
  const { data: current, error: readError } = await c.sb.from("user_ai_settings")
    .select("provider,api_key_ciphertext").eq("user_id", c.user.id).maybeSingle();
  if (readError) return NextResponse.json({ error: "Kişisel AI ayarları okunamadı. Supabase 0007 migration dosyasını çalıştır." }, { status: 503 });

  let encrypted = current?.provider === parsed.data.provider ? current.api_key_ciphertext : null;
  if (parsed.data.apiKey) {
    try { encrypted = encryptSecret(parsed.data.apiKey); }
    catch { return NextResponse.json({ error: "APP_ENCRYPTION_KEY sunucuda tanımlı değil veya geçersiz." }, { status: 503 }); }
  }
  if (!encrypted) return NextResponse.json({ error: "Kendi sağlayıcı API anahtarını ekle." }, { status: 400 });

  const { error } = await c.sb.from("user_ai_settings").upsert({
    user_id: c.user.id, provider: parsed.data.provider, model: parsed.data.model,
    api_key_ciphertext: encrypted, updated_at: new Date().toISOString()
  }, { onConflict: "user_id" });
  if (error) return NextResponse.json({ error: "Kişisel AI ayarın kaydedilemedi." }, { status: 500 });
  return NextResponse.json({ ok: true, keyConfigured: true });
}

