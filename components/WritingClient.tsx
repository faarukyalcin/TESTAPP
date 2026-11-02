"use client";
import { useState } from "react";
const TASKS = ["Kendini tanıt (Name, Alter, Wohnort, Beruf)", "Arkadaşına kısa bir e-posta yaz (Wochenende)", "Doğum günü davet mesajı yaz", "Özür mesajı yaz (Ich komme zu spät)", "Doktor randevusu almak için yaz", "Bilgi iste: Almanca kursu hakkında e-posta yaz", "Günlük rutinini anlat", "Geçen tatilini anlat (Perfekt kullan)"];
const LAB: Record<string, string> = { grammar: "Gramer", vocabulary: "Kelime kullanımı", structure: "Cümle yapısı", spelling: "Yazım", coherence: "Anlam bütünlüğü", task: "Göreve uygunluk" };
type R = { level: string; corrected: string; errors: { original: string; fix: string; reason: string }[]; scores: Record<string, number>; alternatives: string[]; feedback: string };
export default function WritingClient() {
  const [task, setTask] = useState(TASKS[0]); const [text, setText] = useState(""); const [res, setRes] = useState<R | null>(null); const [score, setScore] = useState(0); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(""); setRes(null);
    try { const r = await fetch("/api/writing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ task, text }) }); const d = await r.json(); if (!r.ok) throw Error(d.error); setRes(d.result); setScore(d.score); }
    catch (x) { setErr(x instanceof Error ? x.message : "Hata"); } finally { setBusy(false); }
  }
  return <>
    <form className="panel" onSubmit={submit}>
      <div className="field"><label>Görev</label><select value={task} onChange={e => setTask(e.target.value)}>{TASKS.map(t => <option key={t}>{t}</option>)}</select></div>
      <div className="field"><label>Almanca metnin</label><textarea value={text} onChange={e => setText(e.target.value)} maxLength={2000} placeholder="Hallo, ich heiße …" /></div>
      {err && <p className="error">{err}</p>}<button className="btn" disabled={busy || text.trim().length < 15}>{busy ? "AI değerlendiriyor…" : "Değerlendir"}</button>
    </form>
    {res && <section className="panel"><h2>Sonuç: %{score} · Seviye: {res.level}</h2><p>{res.feedback}</p>
      {Object.entries(res.scores).map(([k, v]) => <div key={k} style={{ margin: "8px 0" }}><div style={{ display: "flex", justifyContent: "space-between" }}><span>{LAB[k] || k}</span><span className="muted">%{v}</span></div><div className="bar"><i style={{ width: `${v}%` }} /></div></div>)}
      <h3>Orijinal metin</h3><div className="passage">{text}</div><h3>Düzeltilmiş metin</h3><div className="passage">{res.corrected}</div>
      <h3>Hatalar ve nedenleri</h3>{res.errors.length ? res.errors.map((x, i) => <p key={i}><span className="error">✗ {x.original}</span> → <span className="ok">{x.fix}</span><br /><span className="muted">{x.reason}</span></p>) : <p className="ok">Belirgin hata bulunamadı 🎉</p>}
      {res.alternatives.length > 0 && <><h3>Daha iyi alternatifler</h3><ul>{res.alternatives.map((a, i) => <li key={i}>{a}</li>)}</ul></>}
      <p className="muted">Bu değerlendirme yapay zekâ tarafından üretilir; resmî sınav puanı değildir.</p></section>}
  </>;
}
