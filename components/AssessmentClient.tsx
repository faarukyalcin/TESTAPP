"use client";
import { useState } from "react";
import Question, { type PQ } from "@/components/Question";
import { SKILL_LABEL } from "@/lib/scoring";
type Res = { level: string; summary: string; strengths: string[]; weaknesses: string[]; scores: Record<string, number | null>; readiness: number; plan: { weekly_focus: string; summary: string; days: { day: string; focus: string; minutes: number }[] } };
export default function AssessmentClient({ questions, defaultMinutes }: { questions: PQ[]; defaultMinutes: number }) {
  const [a, setA] = useState<Record<string, string>>({}); const [intro, setIntro] = useState(""); const [goal, setGoal] = useState("Goethe A2 sınavı"); const [minutes, setMinutes] = useState(defaultMinutes || 30);
  const [res, setRes] = useState<Res | null>(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const answered = questions.filter(q => a[q.id]).length;
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try { const r = await fetch("/api/assessment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers: a, intro, goal, minutes }) }); const d = await r.json(); if (!r.ok) throw Error(d.error); setRes(d.assessment); }
    catch (x) { setErr(x instanceof Error ? x.message : "Hata"); } finally { setBusy(false); }
  }
  if (res) return <>
    <section className="panel"><h2>Tahmini seviyen: {res.level}</h2><p>{res.summary}</p><p className="muted">Test başarı oranı: %{res.readiness}</p>
      {Object.keys(SKILL_LABEL).map(k => <div key={k} style={{ margin: "10px 0" }}><div style={{ display: "flex", justifyContent: "space-between" }}><span>{SKILL_LABEL[k]}</span><span className="muted">{res.scores[k] == null ? "Bu testte ölçülmedi" : `%${res.scores[k]}`}</span></div><div className="bar"><i style={{ width: `${res.scores[k] ?? 0}%` }} /></div></div>)}</section>
    <div className="grid"><section className="panel"><h3>Güçlü yönlerin</h3><ul>{res.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul></section><section className="panel"><h3>Geliştirilecek alanlar</h3><ul>{res.weaknesses.map((s, i) => <li key={i}>{s}</li>)}</ul></section></div>
    <section className="panel"><h3>İlk hafta planın</h3><p>{res.plan.summary}</p>{res.plan.days.map((d, i) => <p key={i}><b>{d.day}</b> — {d.focus} <span className="muted">({d.minutes} dk)</span></p>)}</section>
    <a className="btn" href="/">Panele geç →</a></>;
  return <form onSubmit={submit}>
    {questions.map((q, n) => <section className="panel" key={q.id}><p className="muted">Soru {n + 1} / {questions.length} · {SKILL_LABEL[q.skill]}</p><Question q={q} value={a[q.id] || ""} onChange={v => setA({ ...a, [q.id]: v })} /></section>)}
    <section className="panel"><h2>Kısa yazı</h2><p className="muted">Kendini 3-5 cümleyle Almanca tanıt (Name, Alter, Wohnort, Beruf, Hobby). Bilmiyorsan boş bırakabilirsin.</p><div className="field"><textarea value={intro} onChange={e => setIntro(e.target.value)} maxLength={3000} /></div>
      <div className="grid"><div className="field"><label>Hedefin</label><input value={goal} onChange={e => setGoal(e.target.value)} maxLength={160} required /></div><div className="field"><label>Günlük çalışma süresi (dk)</label><input type="number" min={10} max={180} value={minutes} onChange={e => setMinutes(Number(e.target.value))} /></div></div></section>
    {err && <p className="error">{err}</p>}
    <button className="btn" disabled={busy || answered < questions.length}>{busy ? "Değerlendiriliyor…" : answered < questions.length ? `${questions.length - answered} soru kaldı` : "Testi bitir"}</button>
  </form>;
}
