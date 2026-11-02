"use client";
import { useState, useRef, useEffect } from "react";
type M = { role: "user" | "assistant"; content: string };
export default function ChatClient({ initial }: { initial: M[] }) {
  const [msgs, setMsgs] = useState<M[]>(initial); const [m, setM] = useState(""); const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);
  async function send(e: React.FormEvent) {
    e.preventDefault(); const text = m.trim(); if (!text) return; setBusy(true); setErr(""); setMsgs(x => [...x, { role: "user", content: text }]); setM("");
    try { const r = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text }) }); const d = await r.json(); if (!r.ok) throw Error(d.error); setMsgs(x => [...x, { role: "assistant", content: d.reply }]); }
    catch (x) { setErr(x instanceof Error ? x.message : "Hata"); } finally { setBusy(false); }
  }
  return <section className="panel"><div className="chat">{msgs.length === 0 && <p className="muted">Merhaba yazarak başla: „Hallo, ich lerne Deutsch.“</p>}{msgs.map((x, i) => <div key={i} className={`msg ${x.role}`}>{x.content}</div>)}<div ref={end} /></div>
    <form onSubmit={send}><div className="field"><textarea value={m} onChange={e => setM(e.target.value)} maxLength={4000} placeholder="Mesajını yaz…" /></div>{err && <p className="error">{err}</p>}<button className="btn" disabled={busy || !m.trim()}>{busy ? "Yanıt hazırlanıyor…" : "Gönder"}</button></form></section>;
}
