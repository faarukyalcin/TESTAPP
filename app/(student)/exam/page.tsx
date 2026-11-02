import Link from "next/link";
import { requireStudent } from "@/lib/auth";
import ExamRunner from "@/components/ExamRunner";
export default async function Exam() {
  const { sb, user, profile } = await requireStudent();
  const { data } = await sb.from("exam_results").select("session_id,pct,score,total,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10);
  return <main className="wrap"><h1>Deneme sınavı</h1>
    <p className="muted">Özgün (resmî olmayan) sorularla Goethe tarzı süreli deneme. Resmî örnek materyaller için <a href="https://www.goethe.de/ins/tr/tr/spr/prf.html" target="_blank" rel="noreferrer">Goethe-Institut</a> sayfasına bak.</p>
    <ExamRunner defaultLevel={profile.cefr_level === "A2" ? "A2" : "A1"} />
    <section className="panel"><h2>Önceki denemeler</h2>{(data || []).length ? <table><tbody>{(data || []).map((r: any) => <tr key={r.session_id}><td><Link href={`/exam/${r.session_id}`}>%{r.pct}</Link></td><td>{r.score}/{r.total}</td><td className="muted">{new Date(r.created_at).toLocaleString("tr-TR")}</td></tr>)}</tbody></table> : <p className="muted">Henüz deneme yok.</p>}</section>
  </main>;
}
