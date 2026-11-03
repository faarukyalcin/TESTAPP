"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Question, { type PQ } from "@/components/Question";
type R = { id: string; correct: boolean; answer: string; explanation: string | null };
export default function LessonQuiz({ lessonId, questions }: { lessonId: string; questions: PQ[] }) {
  const [a, setA] = useState<Record<string, string>>({}); const [res, setRes] = useState<{ pct: number; results: R[] } | null>(null);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const router = useRouter();
  async function submit() {
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/lessons/complete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lessonId, answers: a }) });
      const d = await r.json(); if (!r.ok) throw Error(d.error); setRes(d); router.refresh();
    } catch (e) { setErr(e instanceof Error ? e.message : "Hata"); } finally { setBusy(false); }
  }
  return <section className="panel"><h2>Ders sonu testi</h2>
    {questions.map(q => { const r = res?.results.find(x => x.id === q.id); return <div key={q.id} style={{ margin: "18px 0" }}>
      <Question q={q} value={a[q.id] || ""} onChange={v => setA({ ...a, [q.id]: v })} locked={!!res} answer={r?.answer} explanation={r?.explanation} />
      {r && <p className={r.correct ? "ok" : "error"}>{r.correct ? "Doğru ✓" : "Yanlış"} <span className="muted">{r.explanation}</span></p>}</div>; })}
    {err && <p className="error">{err}</p>}
    {res ? <p className="stat">Sonuç: %{res.pct} — ilerlemen kaydedildi.</p> : <button className="btn" disabled={busy || questions.some(q => !a[q.id])} onClick={submit}>{busy ? "Değerlendiriliyor…" : "Testi bitir"}</button>}
  </section>;
}
