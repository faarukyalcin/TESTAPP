import { NextResponse } from "next/server";
import { apiContext } from "@/lib/auth";
import { getAIConfig } from "@/lib/ai";
import { aiAllowed } from "@/lib/limit";

export const runtime = "nodejs";
const MODEL = "models/gemini-3.8-live";

export async function POST() {
  const c = await apiContext();
  if (!c) return NextResponse.json({ error: "Oturum açman gerekiyor." }, { status: 401 });
  if (!(await aiAllowed(c.user.id, "gemini-live", 8))) {
    return NextResponse.json({ error: "Canlı konuşma oturum sınırına ulaştın. Biraz sonra tekrar dene." }, { status: 429 });
  }

  try {
    const config = await getAIConfig(c.user.id, c.sb);
    if (config.provider !== "gemini") {
      return NextResponse.json({ error: "Gemini Live için AI ayarlarından Gemini sağlayıcısını seç." }, { status: 400 });
    }

    const now = Date.now();
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/auth_tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": config.apiKey },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        uses: 1,
        expireTime: new Date(now + 15 * 60 * 1000).toISOString(),
        newSessionExpireTime: new Date(now + 60 * 1000).toISOString()
      })
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || typeof data?.name !== "string") {
      const message = data?.error?.message || "Gemini Live anahtarı doğrulanamadı.";
      console.error("Gemini Live token provisioning failed", response.status, message);
      return NextResponse.json({ error: response.status === 429 || response.status === 503
        ? "Gemini Live şu anda yoğun veya kotaya ulaştı. Biraz sonra tekrar dene."
        : "Gemini Live erişimi açılamadı. Gemini API anahtarını ve Live API erişimini kontrol et." }, { status: 502 });
    }

    return NextResponse.json({ token: data.name, model: MODEL, expiresIn: 15 * 60 });
  } catch (error) {
    console.error("Gemini Live token provisioning failed", error);
    return NextResponse.json({ error: error instanceof Error && error.name === "TimeoutError"
      ? "Gemini Live bağlantısı zaman aşımına uğradı. Tekrar dene."
      : "Gemini Live başlatılamadı. Gemini API anahtarını kontrol et." }, { status: 502 });
  }
}
