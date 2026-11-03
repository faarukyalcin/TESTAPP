import { requireStudent } from "@/lib/auth";
import VoiceClient from "@/components/VoiceClient";
import GeminiLiveTutor from "@/components/GeminiLiveTutor";
import OpenAILiveTutor from "@/components/OpenAILiveTutor";
export default async function Voice() {
  const { sb, user, profile } = await requireStudent();
  const [{ data: past }, { data: st }, aiResult] = await Promise.all([
    sb.from("voice_sessions").select("id,scenario,avg_confidence,seconds,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(6),
    sb.from("user_settings").select("voice_rate").eq("user_id", user.id).maybeSingle(),
    sb.from("user_ai_settings").select("provider,jarvis_provider").eq("user_id", user.id).maybeSingle()
  ]);
  const ai = (aiResult.error ? (await sb.from("user_ai_settings").select("provider").eq("user_id", user.id).maybeSingle()).data : aiResult.data) as { provider?: string | null; jarvis_provider?: string | null } | null;
  const jarvisProvider = ai?.jarvis_provider || ai?.provider || "openai";
  return <main className="wrap"><h1>Sprechen — Sesli pratik</h1>
    <p className="muted">Mikrofonla Almanca konuş; AI partnerin sesli cevap verir ve hatalarını düzeltir. Konuşma tanıma tarayıcıya aittir (Chrome/Edge önerilir). Telaffuz için tarayıcının tanıma güveni gösterilir; bu resmî bir telaffuz puanı değildir.</p>
    {jarvisProvider === "gemini" ? <GeminiLiveTutor level={profile.cefr_level === "A2" ? "A2" : "A1"} /> : <OpenAILiveTutor level={profile.cefr_level === "A2" ? "A2" : "A1"} />}
    <VoiceClient rate={st?.voice_rate ?? 0.9} />
    <section className="panel"><h2>Önceki oturumlar</h2>{(past || []).length ? <table><tbody>{(past || []).map((v: any) => <tr key={v.id}><td>{v.scenario}</td><td>{v.seconds} sn</td><td>{v.avg_confidence == null ? "–" : `tanıma %${Math.round(v.avg_confidence * 100)}`}</td><td className="muted">{new Date(v.created_at).toLocaleDateString("tr-TR")}</td></tr>)}</tbody></table> : <p className="muted">Henüz oturum yok.</p>}</section>
  </main>;
}
