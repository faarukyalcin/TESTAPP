import { notFound } from "next/navigation";
import Link from "next/link";
import { requireStudent } from "@/lib/auth";
import { loadByIds } from "@/lib/server-data";
import { SKILL_LABEL, goetheReadiness } from "@/lib/scoring";
export default async function ExamResult({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { sb, user } = await requireStudent();
  const [{ data: res }, { data: ans }, { data: s }] = await Promise.all([
    sb.from("exam_results").select("*").eq("session_id", id).eq("user_id", user.id).maybeSingle(),
    sb.from("exam_answers").select("exercise_id,answer,correct").eq("session_id", id).eq("user_id", user.id),
    sb.from("exam_sessions").select("level,skill,status").eq("id", id).eq("user_id", user.id).maybeSingle()
  ]);
  if (!res || !s) notFound();
  const qs = await loadByIds((ans || []).map((a: any) => a.exercise_id));
  const wrong = (ans || []).filter((a: any) => !a.correct).map((a: any) => ({ a, q: qs.find(q => q.id === a.exercise_id)! })).filter(x => x.q);
  const by = res.by_skill as Record<string, { c: number; t: number; pct: number }>;
  return <main className="wrap"><Link href="/exam">← Sınavlar</Link><h1>Sonuç: %{res.pct}</h1>
    <p className="muted">{s.level} · {res.score}/{res.total} doğru · {goetheReadiness(res.pct)}{s.status === "late" ? " · süre aşıldı" : ""}</p>
    <section className="panel"><h2>Beceri bazlı</h2>{Object.entries(by).map(([k, v]) => <div key={k} style={{ margin: "10px 0" }}><div style={{ display: "flex", justifyContent: "space-between" }}><span>{SKILL_LABEL[k] || k}</span><span className="muted">{v.c}/{v.t} · %{v.pct}</span></div><div className="bar"><i style={{ width: `${v.pct}%` }} /></div></div>)}</section>
    <section className="panel"><h2>Yanlış cevaplar ({wrong.length})</h2>{wrong.length ? wrong.map(({ a, q }) => <div key={q.id} style={{ margin: "16px 0" }}>{(q.passage || q.audio_text) && <div className="passage">{q.passage || q.audio_text}</div>}<b>{q.prompt}</b><br /><span className="error">Senin cevabın: {a.answer || "(boş)"}</span><br /><span className="ok">Doğru: {q.answer}</span><br /><span className="muted">{q.explanation}</span></div>) : <p className="ok">Hepsi doğru 🎉</p>}</section>
  </main>;
}
