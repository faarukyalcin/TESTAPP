import { NextResponse } from "next/server";
import { apiContext } from "@/lib/auth";
import { askAI } from "@/lib/ai";

export async function POST() {
  const c = await apiContext();
  if (!c) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const started = Date.now();
    const reply = await askAI(
      "You are a connectivity test. Reply with exactly: DeutschAI bağlantısı başarılı.",
      "Bağlantıyı test et.", false, c.user.id, c.sb
    );
    if (!reply.trim()) throw new Error("AI sağlayıcısı boş yanıt döndürdü.");
    return NextResponse.json({ ok: true, latencyMs: Date.now() - started, reply: reply.trim().slice(0, 160) });
  } catch (error) {
    console.error("User AI provider test failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "AI bağlantısı kurulamadı." }, { status: 502 });
  }
}

