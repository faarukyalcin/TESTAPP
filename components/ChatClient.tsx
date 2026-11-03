"use client";
import { useState, useRef, useEffect } from "react";
type M = { role: "user" | "assistant"; content: string };
type Plan = { weekly_focus: string; summary: string; days: { day: string; focus: string; minutes: number }[] };
export default function ChatClient({ initial, initialPlan = null }: { initial: M[]; initialPlan?: Plan | null }) {
  const [msgs, setMsgs] = useState<M[]>(initial); const [m, setM] = useState(""); const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const end = useRef<HTMLDivElement>(null);
  const [plan, setPlan] = useState<Plan | null>(initialPlan);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);
  async function send(e: React.FormEvent) {
    e.preventDefault(); const text = m.trim(); if (!text) return; setBusy(true); setErr(""); setMsgs(x => [...x, { role: "user", content: text }]); setM("");
    try { const r = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text }) }); const d = await r.json(); if (!r.ok) throw Error(d.error); setMsgs(x => [...x, { role: "assistant", content: d.reply }]); if (d.planUpdated && d.plan) setPlan(d.plan as Plan); }
    catch (x) { setErr(x instanceof Error ? x.message : "Hata"); } finally { setBusy(false); }
  }
  return <section className="panel"><div className="chat">{msgs.length === 0 && <p className="muted">Merhaba yazarak başla: „Hallo, ich lerne Deutsch.“ İstersen “Programımı yeniden yap” diyerek çalışma planını da güncelleyebilirsin.</p>}{msgs.map((x, i) => <div key={i} className={`msg ${x.role}`}>{x.content}</div>)}<div ref={end} /></div>
    <form onSubmit={send}><div className="field"><textarea value={m} onChange={e => setM(e.target.value)} maxLength={4000} placeholder="Mesajını yaz…" /></div>{err && <p className="error">{err}</p>}<button className="btn" disabled={busy || !m.trim()}>{busy ? "Yanıt hazırlanıyor…" : "Gönder"}</button></form>
    {plan && <section className="content-card" style={{ marginTop: 18 }}><span className="eyebrow">AKTİF KİŞİSEL PROGRAM</span><h3 style={{ marginBottom: 6 }}>{plan.weekly_focus}</h3><p className="muted">{plan.summary}</p><div className="grid">{plan.days.map(day => <div key={day.day}><b>{day.day}</b><p className="muted">{day.focus} · {day.minutes} dk</p></div>)}</div></section>}
  </section>;
}
