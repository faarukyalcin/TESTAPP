"use client";
import { useState } from "react";
export default function AskTeacher({ data }: { data: { prompt: string; passage: string | null; options: string[]; selected: string; checkedAnswer?: string; explanation?: string | null; skill: string } }) {
  const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false); const [reply, setReply] = useState(""); const [error, setError] = useState("");
  async function ask() {
    setOpen(true); setBusy(true); setError("");
    try { const r = await fetch("/api/ask-teacher", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...data, prompt: data.prompt.slice(0, 600), passage: data.passage?.slice(0, 1500) || "", selected: data.selected.slice(0, 250) }) }); const d = await r.json(); if (!r.ok) throw new Error(d.error); setReply(d.reply); }
    catch (e) { setError(e instanceof Error ? e.message : "AI öğretmene ulaşılamadı."); } finally { setBusy(false); }
  }
  return <div style={{ margin: "8px 0" }}><button type="button" className="btn ghost small" onClick={ask} disabled={busy}>{busy ? "AI öğretmene soruluyor…" : "🤖 Bu soruyu AI öğretmene sor"}</button>
    {open && <div className="panel" style={{ marginTop: 8 }}><button type="button" className="btn ghost small" onClick={() => setOpen(false)}>Kapat</button>{busy ? <p className="muted">Öğretmenin açıklama hazırlıyor…</p> : error ? <p className="error">{error}</p> : <p style={{ whiteSpace: "pre-wrap" }}>{reply}</p>}</div>}</div>;
}
