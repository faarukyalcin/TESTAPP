import { requireStudent } from "@/lib/auth";
import ChatClient from "@/components/ChatClient";
import GeminiLiveTutor from "@/components/GeminiLiveTutor";
import OpenAILiveTutor from "@/components/OpenAILiveTutor";
export default async function Learn() {
  const { sb, user, profile } = await requireStudent();
  const [{ data }, { data: ai }, { data: activePlan }] = await Promise.all([
    sb.from("chat_messages").select("role,content").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30),
    sb.from("user_ai_settings").select("provider").eq("user_id", user.id).maybeSingle(),
    sb.from("learning_plans").select("plan").eq("user_id", user.id).eq("active", true).order("created_at", { ascending: false }).limit(1).maybeSingle()
  ]);
  const level = profile.cefr_level === "A2" ? "A2" : "A1";
  return <main className="wrap"><h1>AI Almanca öğretmenin</h1><p className="muted">Almanca veya Türkçe yaz. Hatalarını düzeltir, kuralı Türkçe açıklar. Önceki konuşmaları ve zayıf yönlerini hatırlar.</p>
    <ChatClient initial={(data || []).reverse() as { role: "user" | "assistant"; content: string }[]} initialPlan={(activePlan?.plan || null) as { weekly_focus: string; summary: string; days: { day: string; focus: string; minutes: number }[] } | null} />
    <section style={{ marginTop: 22 }}>
      <div style={{ marginBottom: 12 }}><h2>Canlı sesli ders</h2><p className="muted">Yazılı öğretmenle aynı kişisel AI sağlayıcını kullanarak gerçek zamanlı Almanca konuş.</p></div>
      {ai?.provider === "gemini" ? <GeminiLiveTutor level={level} /> : ai?.provider === "openai" ? <OpenAILiveTutor level={level} /> : <section className="panel"><h3>AI sağlayıcını bağla</h3><p className="muted">Sesli ders için önce kendi Gemini veya OpenAI API anahtarını ekle.</p><a className="btn" href="/setup/ai">AI ayarlarına git</a></section>}
    </section>
  </main>;
}
