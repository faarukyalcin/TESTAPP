import { requireStudent } from "@/lib/auth";
import WritingClient from "@/components/WritingClient";
export default async function Writing() {
  const { sb, user } = await requireStudent();
  const { data } = await sb.from("writing_submissions").select("id,task,score,level,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(8);
  return <main className="wrap"><h1>Schreiben — Yazma</h1><WritingClient />
    <section className="panel"><h2>Önceki yazılarım</h2>{(data || []).length ? <table><tbody>{(data || []).map((w: any) => <tr key={w.id}><td>{w.task}</td><td>%{w.score}</td><td className="muted">{new Date(w.created_at).toLocaleDateString("tr-TR")}</td></tr>)}</tbody></table> : <p className="muted">Henüz yazı göndermedin.</p>}</section>
  </main>;
}
