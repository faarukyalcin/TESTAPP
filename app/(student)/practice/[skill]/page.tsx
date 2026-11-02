import { notFound } from "next/navigation";
import { requireStudent } from "@/lib/auth";
import { loadPool } from "@/lib/server-data";
import { publicQ, shuffle, SKILL_LABEL } from "@/lib/scoring";
import PracticeSet from "@/components/PracticeSet";

export default async function Practice({ params, searchParams }: { params: Promise<{ skill: string }>; searchParams: Promise<{ level?: string }> }) {
  const { skill } = await params; const sp = await searchParams;
  if (!["lesen", "horen", "wortschatz", "grammatik"].includes(skill)) notFound();
  const { profile } = await requireStudent();
  const level = sp.level === "A1" || sp.level === "A2" ? sp.level : profile.cefr_level === "A2" ? "A2" : "A1";
  const pool = (await loadPool()).filter(q => q.skill === skill && q.level === level);
  // Okuma/dinleme metinleri gruplar halinde kalmalı
  const groups = [...new Set(pool.map(q => q.grp || q.id))];
  const picked = shuffle(groups).flatMap(g => pool.filter(q => (q.grp || q.id) === g)).slice(0, 8);
  return <main className="wrap"><h1>{SKILL_LABEL[skill]}</h1>
    <p className="muted">Seviye: {level} · <a href={`/practice/${skill}?level=A1`}>A1</a> · <a href={`/practice/${skill}?level=A2`}>A2</a></p>
    {skill === "horen" && <p className="muted">Ses kayıtları, tarayıcının Almanca metin okuma (TTS) özelliğiyle oynatılır. Stüdyo kaydı değildir.</p>}
    <PracticeSet key={level + skill} questions={picked.map(publicQ)} />
  </main>;
}
