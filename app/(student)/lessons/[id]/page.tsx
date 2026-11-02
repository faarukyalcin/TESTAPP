import { notFound } from "next/navigation";
import Link from "next/link";
import { requireStudent } from "@/lib/auth";
import { loadBy } from "@/lib/server-data";
import { publicQ } from "@/lib/scoring";
import LessonQuiz from "@/components/LessonQuiz";
import Speak from "@/components/Speak";

export default async function Lesson({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { sb, user } = await requireStudent();
  const { data: l } = await sb.from("lessons").select("*").eq("id", id).maybeSingle();
  if (!l) notFound();
  const [qs, { data: vocab }, { data: prog }] = await Promise.all([loadBy("lesson_id", id), sb.from("vocabulary").select("de,article,tr").eq("level", l.level).limit(8), sb.from("lesson_progress").select("score").eq("user_id", user.id).eq("lesson_id", id).maybeSingle()]);
  return <main className="wrap"><Link href="/lessons">← Dersler</Link>
    <h1>{l.title}</h1><span className="tag">{l.level}</span>{prog && <span className="tag ok">En iyi: %{prog.score}</span>}
    <section className="panel"><h2>Konu anlatımı</h2><p>{l.intro_tr}</p><ul>{(l.points as string[]).map((p, i) => <li key={i} style={{ margin: "8px 0" }}>{p}</li>)}</ul></section>
    <section className="panel"><h2>Örnekler</h2>{(l.examples as { de: string; tr: string }[]).map((e, i) => <p key={i}><b>{e.de}</b> <Speak text={e.de} label="🔊" /><br /><span className="muted">{e.tr}</span></p>)}</section>
    <section className="panel"><h2>Bu seviyeden kelimeler</h2><p className="muted">Tam liste ve tekrar için Kelimeler sayfasını kullan.</p>{(vocab || []).map((v: any) => <span key={v.de} className="tag">{v.article ? `${v.article} ` : ""}{v.de} = {v.tr}</span>)}</section>
    <LessonQuiz lessonId={id} questions={qs.map(publicQ)} />
  </main>;
}
