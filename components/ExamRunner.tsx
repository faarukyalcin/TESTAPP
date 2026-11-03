"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Question, { type PQ } from "@/components/Question";
export default function ExamRunner({ defaultLevel }: { defaultLevel: "A1" | "A2" }) {
  const [level, setLevel] = useState(defaultLevel); const [skill, setSkill] = useState("all");
  const [ex, setEx] = useState<{ sessionId: string; questions: PQ[]; duration_s: number } | null>(null);
  const [i, setI] = useState(0); const [ans, setAns] = useState<Record<string, string>>({}); const [left, setLeft] = useState(0);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const router = useRouter();
  const endAt = useRef(0); const sent = useRef(false); const ansRef = useRef(ans); ansRef.current = ans;

  async function start() {
    setBusy(true); setErr("");
    try { const r = await fetch("/api/exam/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ level, skill }) }); const d = await r.json(); if (!r.ok) throw Error(d.error);
      endAt.current = Date.now() + d.duration_s * 1000; sent.current = false; setLeft(d.duration_s); setAns({}); setI(0); setEx(d); }
    catch (e) { setErr(e instanceof Error ? e.message : "Hata"); } finally { setBusy(false); }
  }
  async function finish() {
    if (!ex || sent.current) return; sent.current = true; setBusy(true); setErr("");
    try { const r = await fetch("/api/exam/finish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: ex.sessionId, answers: ansRef.current }) }); const d = await r.json(); if (!r.ok) throw Error(d.error); router.push(`/exam/${d.sessionId}`); }
    catch (e) { sent.current = false; setErr(e instanceof Error ? e.message : "Gönderilemedi, tekrar dene."); setBusy(false); }
  }
  useEffect(() => {
    if (!ex) return;
    const t = setInterval(() => { const s = Math.max(0, Math.round((endAt.current - Date.now()) / 1000)); setLeft(s); if (s <= 0) { clearInterval(t); finish(); } }, 1000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ex]);

  if (!ex) return <section className="panel"><h2>Sınav başlat</h2>
    <div className="grid"><div className="field"><label>Seviye</label><select value={level} onChange={e => setLevel(e.target.value as "A1" | "A2")}><option>A1</option><option>A2</option></select></div>
    <div className="field"><label>Bölüm</label><select value={skill} onChange={e => setSkill(e.target.value)}><option value="all">Tüm bölümler</option><option value="lesen">Lesen</option><option value="horen">Hören</option><option value="grammatik">Grammatik</option><option value="wortschatz">Wortschatz</option></select></div></div>
    <p className="muted">Süre soru sayısına göre belirlenir. Süre dolunca sınav otomatik bitirilir. Sonuç sunucuda hesaplanır.</p>
    {err && <p className="error">{err}</p>}<button className="btn" onClick={start} disabled={busy}>{busy ? "Hazırlanıyor…" : "Sınava başla"}</button></section>;
  const q = ex.questions[i]; const mm = String(Math.floor(left / 60)).padStart(2, "0"); const ss = String(left % 60).padStart(2, "0");
  const unanswered = ex.questions.filter(x => !ans[x.id]).length;
  return <section className="panel">
    <div style={{ display: "flex", justifyContent: "space-between" }}><b>Soru {i + 1} / {ex.questions.length}</b><b className={left < 60 ? "error" : ""} aria-live="polite">⏱ {mm}:{ss}</b></div>
    <div style={{ margin: "10px 0" }}>{ex.questions.map((x, n) => <button key={x.id} className={`btn small ${n === i ? "" : "ghost"}`} style={{ margin: 2, opacity: ans[x.id] ? 1 : .6 }} onClick={() => setI(n)} aria-label={`Soru ${n + 1}`}>{n + 1}</button>)}</div>
    <Question q={q} value={ans[q.id] || ""} onChange={v => setAns({ ...ans, [q.id]: v })} allowAskTeacher={false} />
    {err && <p className="error">{err}</p>}
    <button className="btn ghost" disabled={i === 0} onClick={() => setI(i - 1)}>← Önceki</button>{" "}
    {i < ex.questions.length - 1 ? <button className="btn" onClick={() => setI(i + 1)}>Sonraki →</button> : null}{" "}
    <button className="btn" disabled={busy} onClick={() => { if (unanswered === 0 || confirm(`${unanswered} soru boş. Yine de bitirmek istiyor musun?`)) finish(); }}>{busy ? "Gönderiliyor…" : "Sınavı bitir"}</button>
  </section>;
}
