"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
export default function Forgot() {
  const [email, setEmail] = useState(""); const [done, setDone] = useState(false); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    const { error } = await supabaseBrowser().auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/auth/confirm?next=/set-password` });
    setBusy(false); if (error && error.status !== 400) setErr("İstek gönderilemedi. Biraz sonra tekrar dene."); else setDone(true);
  }
  return <main className="wrap" style={{ maxWidth: 520, paddingTop: "10vh" }}><div className="brand">Deutsch<b>AI</b></div>
    <section className="panel"><h1>Şifremi unuttum</h1>
      {done ? <p>Bu e-posta ile kayıtlı bir hesap varsa şifre sıfırlama bağlantısı gönderildi. Gelen kutunu (ve spam klasörünü) kontrol et.</p> :
        <form onSubmit={submit}><div className="field"><label>E-posta</label><input type="email" required value={email} onChange={e => setEmail(e.target.value)} /></div>{err && <p className="error">{err}</p>}<button className="btn" disabled={busy}>{busy ? "Gönderiliyor…" : "Bağlantı gönder"}</button></form>}
      <p><a href="/login">← Girişe dön</a></p></section></main>;
}
