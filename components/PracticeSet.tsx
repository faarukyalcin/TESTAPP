"use client";
import { useState } from "react";
import Question, { type PQ } from "@/components/Question";
type R = { correct: boolean; answer: string; explanation: string | null };
export default function PracticeSet({ questions }: { questions: PQ[] }) {
  const [i, setI] = useState(0); const [val, setVal] = useState(""); const [res, setRes] = useState<R | null>(null);
  const [correct, setCorrect] = useState(0); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const done = i >= questions.length;
  async function check() {
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/exercise/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: questions[i].id, answer: val }) });
      const d = await r.json(); if (!r.ok) throw Error(d.error);
      setRes(d); if (d.correct) setCorrect(c => c + 1);
    } catch (e) { setErr(e instanceof Error ? e.message : "Hata"); } finally { setBusy(false); }
  }
  if (!questions.length) return <p className="muted">Bu bölüm için henüz soru yok.</p>;
  if (done) return <section className="panel"><h2>Bitti 🎉</h2><p className="stat">{correct} / {questions.length}</p><button className="btn" onClick={() => { setI(0); setCorrect(0); setRes(null); setVal(""); }}>Tekrar çöz</button></section>;
  const q = questions[i];
  return <section className="panel">
    <p className="muted">Soru {i + 1} / {questions.length}</p>
    <Question q={q} value={val} onChange={setVal} locked={!!res} answer={res?.answer} />
    {err && <p className="error">{err}</p>}
    {res && <p className={res.correct ? "ok" : "error"}>{res.correct ? "Doğru ✓" : `Yanlış. Doğru cevap: ${res.answer}`}<br /><span className="muted">{res.explanation}</span>{q.audio_text && <><br /><span className="muted">Metin: {q.audio_text}</span></>}</p>}
    {!res ? <button className="btn" disabled={!val || busy} onClick={check}>{busy ? "Kontrol ediliyor…" : "Kontrol et"}</button>
      : <button className="btn" onClick={() => { setI(i + 1); setVal(""); setRes(null); }}>{i + 1 === questions.length ? "Bitir" : "Sonraki →"}</button>}
  </section>;
}
