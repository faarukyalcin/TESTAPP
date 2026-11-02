"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export default function StudentControls({ id, active, goal, self }: { id: string; active: boolean; goal: string; self: boolean }) {
  const [g, setG] = useState(goal); const [title, setTitle] = useState(""); const [body, setBody] = useState(""); const [msg, setMsg] = useState(""); const [err, setErr] = useState(""); const r = useRouter();
  async function call(method: string, payload: object, ok: string) {
    setMsg(""); setErr(""); const res = await fetch(`/api/admin/students/${id}`, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); const d = await res.json().catch(() => ({}));
    if (!res.ok) setErr(d.error || "İşlem başarısız"); else { setMsg(ok); r.refresh(); }
  }
  return <section className="panel"><h2>Yönetim</h2>
    <div className="field"><label>Öğrenciye özel hedef (öğrencinin panelinde görünür)</label><input value={g} onChange={e => setG(e.target.value)} maxLength={300} /></div>
    <button className="btn small" onClick={() => call("PATCH", { admin_goal: g.trim() || null }, "Hedef kaydedildi ✓")}>Hedefi kaydet</button>
    <hr style={{ borderColor: "var(--line)", margin: "18px 0" }} />
    <div className="field"><label>Görev / bildirim gönder</label><input placeholder="Başlık (ör. Perfekt dersini bitir)" value={title} onChange={e => setTitle(e.target.value)} maxLength={120} /><textarea placeholder="Açıklama (isteğe bağlı)" value={body} onChange={e => setBody(e.target.value)} maxLength={500} /></div>
    <button className="btn small" disabled={title.trim().length < 2} onClick={() => { call("POST", { title, body }, "Görev gönderildi ✓"); setTitle(""); setBody(""); }}>Görevi gönder</button>
    <hr style={{ borderColor: "var(--line)", margin: "18px 0" }} />
    <button className="btn ghost small" disabled={self} onClick={() => { if (confirm(active ? "Hesap devre dışı bırakılsın mı? Öğrenci giriş yapamaz." : "Hesap yeniden etkinleştirilsin mi?")) call("PATCH", { active: !active }, active ? "Hesap devre dışı bırakıldı" : "Hesap etkinleştirildi"); }}>{active ? "Hesabı devre dışı bırak" : "Hesabı etkinleştir"}</button>
    {msg && <p className="ok">{msg}</p>}{err && <p className="error">{err}</p>}</section>;
}
