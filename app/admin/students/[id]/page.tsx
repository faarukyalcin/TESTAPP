import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import StudentControls from "@/components/StudentControls";
import { SKILL_LABEL } from "@/lib/scoring";

export default async function StudentDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireAdmin();
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const a = supabaseAdmin();
  const { data: p } = await a.from("profiles").select("*").eq("id", id).maybeSingle();
  if (!p) notFound();
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [u, asm, exams, study, lessons, vocab, writing] = await Promise.all([
    a.auth.admin.getUserById(id),
    a.from("assessments").select("level,input,summary,created_at").eq("user_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    a.from("exam_results").select("pct,score,total,created_at").eq("user_id", id).order("created_at", { ascending: false }).limit(8),
    a.from("study_sessions").select("seconds,created_at").eq("user_id", id).gte("created_at", since),
    a.from("lesson_progress").select("lesson_id,score").eq("user_id", id),
    a.from("vocabulary_progress").select("learned").eq("user_id", id),
    a.from("writing_submissions").select("score").eq("user_id", id)
  ]);
  const weekMin = Math.round((study.data || []).reduce((s: number, r: any) => s + r.seconds, 0) / 60);
  const scores = (asm.data?.input?.scores || {}) as Record<string, number | null>;
  return <main className="wrap"><Link href="/admin">← Yönetim</Link>
    <h1>{p.display_name || "İsimsiz"} <span className="tag">{p.cefr_level || "Test yok"}</span></h1>
    <p className="muted">{u.data.user?.email} · hedef: {p.learning_goal || "–"} · günlük {p.daily_minutes} dk · XP {p.xp}</p>
    <div className="grid">
      <section className="panel"><p className="muted">SON 7 GÜN</p><p className="stat">{weekMin} dk</p></section>
      <section className="panel"><p className="muted">DERS</p><p className="stat">{(lessons.data || []).length}</p></section>
      <section className="panel"><p className="muted">ÖĞRENİLEN KELİME</p><p className="stat">{(vocab.data || []).filter((v: any) => v.learned).length}</p></section>
      <section className="panel"><p className="muted">YAZMA ÖDEVİ</p><p className="stat">{(writing.data || []).length}</p></section>
    </div>
    <section className="panel"><h2>Seviye tespiti</h2>{asm.data ? <><p>{asm.data.summary}</p>{Object.keys(SKILL_LABEL).map(k => <p key={k}>{SKILL_LABEL[k]}: {scores[k] == null ? "–" : `%${scores[k]}`}</p>)}</> : <p className="muted">Henüz tamamlamadı.</p>}</section>
    <section className="panel"><h2>Sınav sonuçları</h2>{(exams.data || []).length ? <table><tbody>{(exams.data || []).map((e: any, i: number) => <tr key={i}><td>%{e.pct}</td><td>{e.score}/{e.total}</td><td className="muted">{new Date(e.created_at).toLocaleString("tr-TR")}</td></tr>)}</tbody></table> : <p className="muted">Sınav yok.</p>}</section>
    <StudentControls id={id} active={p.active} goal={p.admin_goal || ""} self={me.user.id === id} />
  </main>;
}
