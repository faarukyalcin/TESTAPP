"use client";
import { useState } from "react";
import Link from "next/link";
type Row = { id: string; name: string; email: string; level: string; active: boolean; xp: number };
export default function StudentTable({ rows }: { rows: Row[] }) {
  const [q, setQ] = useState(""); const [lv, setLv] = useState(""); const [st, setSt] = useState("");
  const f = rows.filter(r => (r.name + r.email).toLowerCase().includes(q.toLowerCase()) && (!lv || r.level === lv) && (!st || (st === "on") === r.active));
  return <section className="panel"><h2>Öğrenciler ({f.length})</h2>
    <div className="grid"><div className="field"><label>Ara</label><input value={q} onChange={e => setQ(e.target.value)} placeholder="ad veya e-posta" /></div>
      <div className="field"><label>Seviye</label><select value={lv} onChange={e => setLv(e.target.value)}><option value="">Hepsi</option><option>A1</option><option>A2</option></select></div>
      <div className="field"><label>Durum</label><select value={st} onChange={e => setSt(e.target.value)}><option value="">Hepsi</option><option value="on">Aktif</option><option value="off">Devre dışı</option></select></div></div>
    <div style={{ overflowX: "auto" }}><table><thead><tr><th>Ad</th><th>E-posta</th><th>Seviye</th><th>XP</th><th>Durum</th></tr></thead><tbody>
      {f.map(r => <tr key={r.id}><td><Link href={`/admin/students/${r.id}`}>{r.name}</Link></td><td>{r.email}</td><td>{r.level || "Test yok"}</td><td>{r.xp}</td><td>{r.active ? "Aktif" : "Devre dışı"}</td></tr>)}</tbody></table></div>
    {!f.length && <p className="muted">Kayıt bulunamadı.</p>}</section>;
}
