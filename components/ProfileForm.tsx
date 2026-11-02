"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
type S = { display_name: string; learning_goal: string; daily_minutes: number; target_level: "A1" | "A2"; theme: "light" | "dark"; voice_rate: number; notify_daily: boolean; notify_weekly: boolean };
export default function ProfileForm({ initial }: { initial: S }) {
  const [s, setS] = useState(initial); const [msg, setMsg] = useState(""); const [err, setErr] = useState(""); const [pw, setPw] = useState(""); const router = useRouter();
  const set = <K extends keyof S>(k: K, v: S[K]) => setS(x => ({ ...x, [k]: v }));
  async function save(e: React.FormEvent) {
    e.preventDefault(); setMsg(""); setErr("");
    const r = await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(s) }); const d = await r.json().catch(() => ({}));
    if (!r.ok) setErr(d.error || "Kaydedilemedi"); else { setMsg("Ayarlar kaydedildi ✓"); router.refresh(); }
  }
  async function changePw(e: React.FormEvent) {
    e.preventDefault(); setMsg(""); setErr("");
    if (pw.length < 10) { setErr("Şifre en az 10 karakter olmalı."); return; }
    const { error } = await supabaseBrowser().auth.updateUser({ password: pw });
    if (error) setErr(error.message); else { setMsg("Şifre değiştirildi ✓"); setPw(""); }
  }
  return <>
    <form className="panel" onSubmit={save}><h2>Profil</h2>
      <div className="field"><label>Ad</label><input value={s.display_name} onChange={e => set("display_name", e.target.value)} maxLength={60} required /></div>
      <div className="field"><label>Öğrenme hedefi</label><input value={s.learning_goal} onChange={e => set("learning_goal", e.target.value)} maxLength={160} /></div>
      <div className="grid"><div className="field"><label>Günlük çalışma (dk)</label><input type="number" min={5} max={240} value={s.daily_minutes} onChange={e => set("daily_minutes", Number(e.target.value))} /></div>
        <div className="field"><label>Hedef seviye</label><select value={s.target_level} onChange={e => set("target_level", e.target.value as "A1" | "A2")}><option>A1</option><option>A2</option></select></div>
        <div className="field"><label>Tema</label><select value={s.theme} onChange={e => set("theme", e.target.value as "light" | "dark")}><option value="dark">Koyu</option><option value="light">Açık</option></select></div>
        <div className="field"><label>Ses hızı ({s.voice_rate.toFixed(1)})</label><input type="range" min={0.5} max={1.2} step={0.1} value={s.voice_rate} onChange={e => set("voice_rate", Number(e.target.value))} /></div></div>
      <label className="opt"><input type="checkbox" checked={s.notify_daily} onChange={e => set("notify_daily", e.target.checked)} /> Günlük hatırlatma bildirimleri</label>
      <label className="opt"><input type="checkbox" checked={s.notify_weekly} onChange={e => set("notify_weekly", e.target.checked)} /> Haftalık özet bildirimleri</label>
      <p className="muted">Bildirimler uygulama içinde gösterilir (e-posta/push yok).</p>
      <button className="btn">Kaydet</button></form>
    <form className="panel" onSubmit={changePw}><h2>Şifre değiştir</h2><div className="field"><label>Yeni şifre (en az 10 karakter)</label><input type="password" value={pw} onChange={e => setPw(e.target.value)} autoComplete="new-password" /></div><button className="btn">Şifreyi güncelle</button></form>
    {msg && <p className="ok">{msg}</p>}{err && <p className="error">{err}</p>}
  </>;
}
