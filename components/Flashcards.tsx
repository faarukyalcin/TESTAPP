"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Speak from "@/components/Speak";
type C = { id: number; de: string; article: string | null; plural: string | null; tr: string; example_de: string | null; example_tr: string | null; level: string; category: string; favorite: boolean };
export default function Flashcards({ cards }: { cards: C[] }) {
  const [i, setI] = useState(0); const [show, setShow] = useState(false); const [fav, setFav] = useState<Record<number, boolean>>({}); const [err, setErr] = useState(""); const router = useRouter();
  if (!cards.length) return <section className="panel"><h2>Bugünlük bitti 🎉</h2><p className="muted">Tekrar bekleyen veya yeni kelime kalmadı.</p></section>;
  if (i >= cards.length) return <section className="panel"><h2>Tur tamamlandı 🎉</h2><button className="btn" onClick={() => router.refresh()}>Yeni turu yükle</button></section>;
  const c = cards[i]; const isFav = fav[c.id] ?? c.favorite;
  async function post(body: object) { const r = await fetch("/api/vocab", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); if (!r.ok) { setErr("Kaydedilemedi, tekrar dene."); return false; } setErr(""); return true; }
  async function grade(g: number) { if (await post({ id: c.id, grade: g })) { setShow(false); setI(i + 1); } }
  return <section className="panel flash">
    <p className="muted">{i + 1} / {cards.length} · {c.level} · {c.category}</p>
    <p className="de">{c.article ? `${c.article} ` : ""}{c.de}</p>
    <p><Speak text={`${c.article ? c.article + " " : ""}${c.de}`} /> <button className="btn ghost small" onClick={async () => { const v = !isFav; if (await post({ id: c.id, favorite: v })) setFav({ ...fav, [c.id]: v }); }}>{isFav ? "⭐ Favori" : "☆ Favoriye ekle"}</button></p>
    {show ? <>
      <h2>{c.tr}</h2>{c.plural && <p className="muted">Çoğul: die {c.plural}</p>}
      {c.example_de && <p><i>{c.example_de}</i> <Speak text={c.example_de} label="🔊" /><br /><span className="muted">{c.example_tr}</span></p>}
      <p className="muted">Ne kadar iyi hatırladın?</p>
      <button className="btn ghost" onClick={() => grade(0)}>Bilmiyorum</button> <button className="btn ghost" onClick={() => grade(1)}>Zor</button> <button className="btn" onClick={() => grade(2)}>İyi</button> <button className="btn" onClick={() => grade(3)}>Kolay</button>
    </> : <button className="btn" onClick={() => setShow(true)}>Anlamı göster</button>}
    {err && <p className="error">{err}</p>}
  </section>;
}
