import Link from "next/link";
import { requireStudent } from "@/lib/auth";
export default async function Lessons() {
  const { sb, user } = await requireStudent();
  const [{ data: courses }, { data: lessons }, { data: prog }] = await Promise.all([
    sb.from("courses").select("*").order("position"), sb.from("lessons").select("id,course_id,title,position").order("position"),
    sb.from("lesson_progress").select("lesson_id,score").eq("user_id", user.id)
  ]);
  const done = new Map((prog || []).map((p: any) => [p.lesson_id, p.score]));
  return <main className="wrap"><h1>Dersler</h1>
    {(courses || []).map((c: any) => <section className="panel" key={c.id}><h2>{c.title}</h2><p className="muted">{c.description}</p>
      {(lessons || []).filter((l: any) => l.course_id === c.id).map((l: any) => <p key={l.id}><Link href={`/lessons/${l.id}`}>{l.title}</Link> {done.has(l.id) ? <span className="tag ok">✓ %{done.get(l.id)}</span> : <span className="tag">Başlamadı</span>}</p>)}
    </section>)}
  </main>;
}
