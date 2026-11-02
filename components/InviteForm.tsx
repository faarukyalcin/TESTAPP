"use client";
import { useState } from "react";
export default function InviteForm() {
  const [email, setEmail] = useState(""); const [msg, setMsg] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(""); setErr("");
    const r = await fetch("/api/admin/invite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) }); const d = await r.json().catch(() => ({}));
    setBusy(false); if (!r.ok) setErr(d.error || "Davet gönderilemedi"); else { setMsg(`${email} adresine davet gönderildi ✓`); setEmail(""); }
  }
  return <form className="panel" onSubmit={submit}><h2>Öğrenci davet et</h2><div className="field"><label>E-posta</label><input type="email" required value={email} onChange={e => setEmail(e.target.value)} /></div>{msg && <p className="ok">{msg}</p>}{err && <p className="error">{err}</p>}<button className="btn" disabled={busy}>{busy ? "Gönderiliyor…" : "Davet gönder"}</button></form>;
}
