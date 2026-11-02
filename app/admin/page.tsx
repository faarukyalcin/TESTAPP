import { requireAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import InviteForm from "@/components/InviteForm";
import StudentTable from "@/components/StudentTable";
import Link from "next/link";

export default async function AdminHome() {
  await requireAdmin();
  const a = supabaseAdmin();
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [{ data: profiles }, users, exams, lessons, study, assessments] = await Promise.all([
    a.from("profiles").select("id,display_name,role,cefr_level,active,xp,daily_minutes"),
    a.auth.admin.listUsers({ page: 1, perPage: 500 }),
    a.from("exam_results").select("session_id", { count: "exact", head: true }),
    a.from("lesson_progress").select("lesson_id", { count: "exact", head: true }),
    a.from("study_sessions").select("seconds").gte("created_at", since).limit(20000),
    a.from("assessments").select("id", { count: "exact", head: true })
  ]);
  const email = new Map((users.data?.users || []).map(u => [u.id, u.email || ""]));
  const students = (profiles || []).filter((p: any) => p.role === "student").map((p: any) => ({ id: p.id, name: p.display_name || "—", email: email.get(p.id) || "", level: p.cefr_level || "", active: p.active, xp: p.xp }));
  const weekMin = Math.round((study.data || []).reduce((s: number, r: any) => s + r.seconds, 0) / 60);
  return <main className="wrap"><h1>Yönetim paneli</h1><p><Link href="/">← Öğrenci görünümü</Link></p>
    <div className="grid">
      <section className="panel"><p className="muted">ÖĞRENCİ</p><p className="stat">{students.length}</p><p className="muted">{students.filter(s => s.active).length} aktif</p></section>
      <section className="panel"><p className="muted">SEVİYE TESTİ</p><p className="stat">{assessments.count ?? 0}</p></section>
      <section className="panel"><p className="muted">DENEME SINAVI</p><p className="stat">{exams.count ?? 0}</p></section>
      <section className="panel"><p className="muted">TAMAMLANAN DERS</p><p className="stat">{lessons.count ?? 0}</p></section>
      <section className="panel"><p className="muted">SON 7 GÜN ÇALIŞMA</p><p className="stat">{weekMin} dk</p></section>
    </div>
    <div className="panel"><h2>Platform ayarları</h2><p className="muted">AI sağlayıcısı ve API anahtarını yönet.</p><Link className="btn" href="/admin/ai">AI ayarlarını aç →</Link></div>
    <InviteForm />
    <StudentTable rows={students} />
  </main>;
}
