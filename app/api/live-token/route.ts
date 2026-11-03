import { NextResponse } from "next/server";
import { apiContext } from "@/lib/auth";
import { getAIConfig } from "@/lib/ai";
import { aiAllowed } from "@/lib/limit";

export const runtime = "nodejs";
const MODEL = "models/gemini-3.8-live";

export async function POST(req: Request) {
  const c = await apiContext();
  if (!c) return NextResponse.json({ error: "Oturum açman gerekiyor." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const scenario = typeof body?.scenario === "string" && ["vorstellen", "einkaufen", "restaurant", "arzt", "weg"].includes(body.scenario) ? body.scenario : "vorstellen";
  const level = c.profile.cefr_level === "A2" ? "A2" : "A1";
  let config;
  try { config = await getAIConfig(c.user.id, c.sb, "jarvis"); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Jarvis API ayarlarını kontrol et." }, { status: 400 }); }
  const limitKey = config.provider === "openai" ? "openai-live" : "gemini-live";
  if (!(await aiAllowed(c.user.id, limitKey, 8))) {
    return NextResponse.json({ error: "Canlı konuşma oturum sınırına ulaştın. Biraz sonra tekrar dene." }, { status: 429 });
  }

  try {
    if (config.provider === "openai") {
      const scenarioNames: Record<string, string> = {
        vorstellen: "Kennenlernen und sich vorstellen", einkaufen: "Im Supermarkt einkaufen",
        restaurant: "Im Restaurant bestellen", arzt: "Beim Arzt einen Termin vereinbaren", weg: "Nach dem Weg fragen"
      };
      const instructions = `You are a patient German teacher for a Turkish-speaking ${level} learner. Conduct a natural, turn-by-turn spoken role-play about: ${scenarioNames[scenario]}. Speak slowly in short, simple German sentences. Ask one question at a time. Correct German mistakes by first saying the corrected German sentence, then briefly explaining the rule in Turkish, then continue in German. If the student speaks Turkish, answer briefly in Turkish and guide them back to German. Encourage the learner and avoid long lectures.`;
      const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({
          expires_after: { anchor: "created_at", seconds: 600 },
          session: {
            type: "realtime", model: "gpt-realtime", instructions, output_modalities: ["audio"],
            audio: {
              input: { transcription: { model: "gpt-4o-mini-transcribe", language: "de" }, turn_detection: { type: "server_vad" } },
              output: { voice: "marin" }
            }
          }
        })
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || typeof data?.value !== "string") {
        const message = data?.error?.message || "OpenAI Realtime anahtarı doğrulanamadı.";
        console.error("OpenAI realtime token provisioning failed", response.status, message);
        return NextResponse.json({ error: response.status === 429 || response.status === 503
          ? "OpenAI Live şu anda yoğun veya kota dolu. Biraz sonra tekrar dene."
          : "ChatGPT Live erişimi açılamadı. OpenAI API anahtarının Realtime erişimini kontrol et." }, { status: 502 });
      }
      return NextResponse.json({ token: data.value, provider: "openai", expiresIn: data.expires_at });
    }

    const now = Date.now();
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/auth_tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": config.apiKey },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        uses: 1,
        expireTime: new Date(now + 15 * 60 * 1000).toISOString(),
        newSessionExpireTime: new Date(now + 60 * 1000).toISOString(),
        liveConnectConstraints: {
          model: MODEL,
          config: { responseModalities: ["AUDIO"], sessionResumption: {} }
        }
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

    return NextResponse.json({ token: data.name, provider: "gemini", model: MODEL, expiresIn: 15 * 60 });
  } catch (error) {
    console.error(`${config.provider} live token provisioning failed`, error);
    const providerName = config.provider === "openai" ? "OpenAI Live" : "Gemini Live";
    return NextResponse.json({ error: error instanceof Error && error.name === "TimeoutError"
      ? `${providerName} bağlantısı zaman aşımına uğradı. Tekrar dene.`
      : `${providerName} başlatılamadı. API anahtarını kontrol et.` }, { status: 502 });
  }
}
