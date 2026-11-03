import { requireStudent } from "@/lib/auth";
import ChatClient from "@/components/ChatClient";
import GeminiLiveTutor from "@/components/GeminiLiveTutor";
import OpenAILiveTutor from "@/components/OpenAILiveTutor";
import JarvisControl from "@/components/JarvisControl";
export default async function Learn() {
  const { sb, user, profile } = await requireStudent();
  const [{ data }, aiResult, { data: activePlan }] = await Promise.all([
    sb.from("chat_messages").select("role,content").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30),
    sb.from("user_ai_settings").select("provider,jarvis_provider").eq("user_id", user.id).maybeSingle(),
    sb.from("learning_plans").select("plan").eq("user_id", user.id).eq("active", true).order("created_at", { ascending: false }).limit(1).maybeSingle()
  ]);
  const ai = (aiResult.error ? (await sb.from("user_ai_settings").select("provider").eq("user_id", user.id).maybeSingle()).data : aiResult.data) as { provider?: string | null; jarvis_provider?: string | null } | null;
  const jarvisProvider = ai?.jarvis_provider || ai?.provider || "openai";
  const level = profile.cefr_level === "A2" ? "A2" : "A1";
  return <main className="wrap"><h1>Jarvis · AI Almanca öğretmenin</h1><p className="muted">İlerlemeni analiz et, çalışma planını konuşarak yönet veya Almanca pratiği yap.</p>
    <JarvisControl />
    <ChatClient initial={(data || []).reverse() as { role: "user" | "assistant"; content: string }[]} initialPlan={(activePlan?.plan || null) as { weekly_focus: string; summary: string; days: { day: string; focus: string; minutes: number }[] } | null} />
    <section style={{ marginTop: 22 }}>
      <div style={{ marginBottom: 12 }}><h2>Canlı sesli ders</h2><p className="muted">Yazılı öğretmenle aynı kişisel AI sağlayıcını kullanarak gerçek zamanlı Almanca konuş.</p></div>
      {jarvisProvider === "gemini" ? <GeminiLiveTutor level={level} /> : <OpenAILiveTutor level={level} />}
    </section>
  </main>;
}
