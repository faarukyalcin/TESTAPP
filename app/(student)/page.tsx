import Link from "next/link";
import { requireStudent } from "@/lib/auth";
import { dayKey, streakFromDates, SKILL_LABEL, pct } from "@/lib/scoring";

export default async function Home() {
  const { sb, user, profile } = await requireStudent();
  const nowIso = new Date().toISOString();
  const [study, vocab, vocabTotal, aiLessons, exams, asm, plan, task] = await Promise.all([
    sb.from("study_sessions").select("seconds,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5000),
    sb.from("vocabulary_progress").select("learned,due_at").eq("user_id", user.id),
    sb.from("vocabulary").select("id", { count: "exact", head: true }),
    sb.from("ai_lessons").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    sb.from("exam_results").select("pct,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(3),
    sb.from("assessments").select("level,input,summary,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    sb.from("learning_plans").select("plan").eq("user_id", user.id).eq("active", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    sb.from("notifications").select("title,body").eq("user_id", user.id).eq("kind", "task").eq("read", false).limit(3)
  ]);
  const rows = study.data || [];
  const today = dayKey(Date.now());
  const sec = (f: (r: any) => boolean) => rows.filter(f).reduce((a: number, r: any) => a + r.seconds, 0);
  const todayMin = Math.round(sec(r => dayKey(r.created_at) === today) / 60);
  const weekMin = Math.round(sec(r => Date.now() - new Date(r.created_at).getTime() < 7 * 86_400_000) / 60);
  const totalMin = Math.round(sec(() => true) / 60);
  const streak = streakFromDates(rows.map((r: any) => r.created_at));
  const learned = (vocab.data || []).filter((v: any) => v.learned).length;
  const due = (vocab.data || []).filter((v: any) => v.due_at <= nowIso).length;
  const goalPct = Math.min(100, pct(todayMin, profile.daily_minutes));
  const scores = (asm.data?.input?.scores || {}) as Record<string, number | null>;
  const dow = (new Date(Date.now() + 3 * 3600_000).getUTCDay() + 6) % 7;
  const days = (plan.data?.plan?.days || []) as { day: string; focus: string; minutes: number }[];
  const todayPlan = days[dow];
  const goethe = (plan.data?.plan as any)?.goethe;
  return <main className="wrap">
    <h1>Guten Tag{profile.display_name ? `, ${profile.display_name}` : ""} 👋</h1>
    <p className="muted">Seviye: <b>{profile.cefr_level || "–"}</b> · Hedef: {profile.target_level} · XP: {profile.xp}</p>
    {profile.admin_goal && <section className="panel"><b>Öğretmeninin hedefi:</b> {profile.admin_goal}</section>}
    {(task.data || []).length > 0 && <section className="panel"><b>Yeni görev</b>{(task.data || []).map((t: any, i: number) => <p key={i}>• {t.title}{t.body ? ` — ${t.body}` : ""}</p>)}<Link href="/notifications">Bildirimlere git →</Link></section>}
    <div className="grid">
      <section className="panel"><p className="muted">BUGÜN</p><p className="stat">{todayMin} / {profile.daily_minutes} dk</p><div className="bar"><i style={{ width: `${goalPct}%` }} /></div><p className="muted">Günlük hedef %{goalPct}</p></section>
      <section className="panel"><p className="muted">ÇALIŞMA SERİSİ</p><p className="stat">{streak} gün 🔥</p><p className="muted">Hafta: {weekMin} dk · Toplam: {totalMin} dk</p></section>
      <section className="panel"><p className="muted">KELİMELER</p><p className="stat">{learned} / {vocabTotal.count ?? 0}</p><p className="muted">{due} kelime tekrar bekliyor</p><Link className="btn small" href="/vocabulary">Kelime çalış →</Link></section>
      <section className="panel"><p className="muted">AI DERSLERİM</p><p className="stat">{aiLessons.count ?? 0} ders</p><Link className="btn small" href="/lessons">AI ile yeni ders →</Link></section>
    </div>
    <section className="panel"><p className="muted">BUGÜNÜN PLANI</p>
      {todayPlan ? <><h2>{todayPlan.day}: {todayPlan.focus}</h2><p className="muted">{todayPlan.minutes} dakika · {plan.data?.plan?.weekly_focus}</p></> : <p className="muted">Aktif plan yok.</p>}
      <PlanButton />
    </section>
    {goethe?.weeks?.length > 0 && <section className="panel"><h2>Goethe {goethe.exam_level} hazırlık programı</h2>{goethe.weeks.map((w: any) => <details key={w.week}><summary>{w.week}. hafta — {w.focus}</summary><p>{(w.skills || []).join(" · ")}</p><p className="muted">{w.practice}</p></details>)}</section>}
    <section className="panel"><h2>Beceri durumu</h2><p className="muted">Son seviye tespitine göre (sınav sonuçları İlerleme sayfasında).</p>
      {Object.keys(SKILL_LABEL).map(k => <div key={k} style={{ margin: "10px 0" }}><div style={{ display: "flex", justifyContent: "space-between" }}><span>{SKILL_LABEL[k]}</span><span className="muted">{scores[k] == null ? "Henüz ölçülmedi" : `%${scores[k]}`}</span></div><div className="bar"><i style={{ width: `${scores[k] ?? 0}%` }} /></div></div>)}
    </section>
    <section className="panel"><h2>Son denemeler</h2>
      {(exams.data || []).length ? <ul>{(exams.data || []).map((e: any, i: number) => <li key={i}>%{e.pct} — {new Date(e.created_at).toLocaleDateString("tr-TR")}</li>)}</ul> : <p className="muted">Henüz deneme sınavı çözmedin.</p>}
      <Link className="btn small" href="/exam">Deneme sınavı →</Link> <Link className="btn ghost small" href="/assessment">Seviye testini tekrarla</Link>
    </section>
  </main>;
}
import PlanButton from "@/components/PlanButton";
