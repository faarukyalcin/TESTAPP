import Link from "next/link";
import { requireStudent } from "@/lib/auth";
import { dayKey, streakFromDates, SKILL_LABEL, pct } from "@/lib/scoring";
import PlanButton from "@/components/PlanButton";

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

  return <main className="wrap dashboard">
    <header className="dashboard-hero">
      <div className="dashboard-hero-copy">
        <div className="eyebrow"><span className="eyebrow-dot" /> DEUTSCHAI · ÖĞRENME MERKEZİ</div>
        <h1>Guten Tag{profile.display_name ? `, ${profile.display_name}` : ""}</h1>
        <p>Bugünkü küçük adımın, Almanca hedefini biraz daha yaklaştırsın.</p>
        <div className="learner-meta">
          <span><small>MEVCUT SEVİYE</small><b>{profile.cefr_level || "Belirlenmedi"}</b></span>
          <span><small>HEDEF</small><b>Goethe {profile.target_level}</b></span>
          <span><small>TOPLAM XP</small><b>{profile.xp}</b></span>
        </div>
      </div>
      <div className="hero-action-card">
        <div className="hero-action-icon">✦</div>
        <div><span className="eyebrow">BUGÜNÜN ADIMI</span><h2>{todayPlan?.focus || "Almancaya başla"}</h2></div>
        <p>{todayPlan ? `${todayPlan.minutes} dakikalık kişisel çalışma planın hazır.` : "AI öğretmeninle hedeflerine uygun ilk dersini oluştur."}</p>
        <Link className="btn" href={todayPlan ? "/lessons" : "/learn"}>{todayPlan ? "Derse devam et" : "İlk dersini oluştur"} <span aria-hidden="true">↗</span></Link>
      </div>
    </header>

    {profile.admin_goal && <section className="notice-card"><span className="notice-mark">i</span><div><b>Öğretmeninin notu</b><p>{profile.admin_goal}</p></div></section>}
    {(task.data || []).length > 0 && <section className="notice-card"><span className="notice-mark">!</span><div><b>Yeni görev</b>{(task.data || []).map((t: any, i: number) => <p key={i}>{t.title}{t.body ? ` — ${t.body}` : ""}</p>)}<Link href="/notifications">Tüm bildirimler <span aria-hidden="true">→</span></Link></div></section>}

    <div className="section-heading"><div><span className="eyebrow">AKTİVİTE</span><h2>Öğrenme özeti</h2></div><span className="date-label">{new Intl.DateTimeFormat("tr-TR", { dateStyle: "long" }).format(new Date())}</span></div>
    <div className="metric-grid">
      <section className="metric-card metric-primary"><div className="metric-top"><span>GÜNLÜK HEDEF</span><span className="metric-icon">◷</span></div><p className="metric-value">{todayMin}<small> / {profile.daily_minutes} dk</small></p><div className="bar"><i style={{ width: `${goalPct}%` }} /></div><p className="metric-caption">Bugünkü hedefin %{goalPct} tamamlandı</p></section>
      <section className="metric-card"><div className="metric-top"><span>ÇALIŞMA SERİSİ</span><span className="metric-icon">↗</span></div><p className="metric-value">{streak}<small> gün</small></p><p className="metric-caption">Bu hafta {weekMin} dk · Toplam {totalMin} dk</p></section>
      <section className="metric-card"><div className="metric-top"><span>KELİME HAFIZASI</span><span className="metric-icon">Aa</span></div><p className="metric-value">{learned}<small> / {vocabTotal.count ?? 0}</small></p><p className="metric-caption">{due > 0 ? `${due} kelime tekrar bekliyor` : "Tekrar gerektiren kelime yok"}</p></section>
      <section className="metric-card"><div className="metric-top"><span>AI DERSLERİ</span><span className="metric-icon">✦</span></div><p className="metric-value">{aiLessons.count ?? 0}<small> ders</small></p><p className="metric-caption"><Link href="/lessons">Ders arşivini görüntüle →</Link></p></section>
    </div>

    <div className="dashboard-columns">
      <section className="content-card plan-card">
        <div className="section-heading"><div><span className="eyebrow">KİŞİSEL PROGRAM</span><h2>Bugünkü çalışma planın</h2></div><span className="plan-duration">{todayPlan?.minutes ?? profile.daily_minutes} dk</span></div>
        {todayPlan ? <><h3>{todayPlan.day}: {todayPlan.focus}</h3><p className="muted">{plan.data?.plan?.weekly_focus || "Bu hafta Almanca becerilerini dengeli biçimde geliştir."}</p></> : <p className="muted">Henüz aktif bir çalışma planı oluşturulmamış. AI öğretmenin seviyene göre bir program hazırlayabilir.</p>}
        <div className="plan-actions"><PlanButton /><Link className="text-link" href="/learn">AI öğretmenle çalış <span aria-hidden="true">→</span></Link></div>
      </section>
      <section className="content-card quick-card">
        <span className="eyebrow">HIZLI BAŞLANGIÇ</span><h2>Bugün ne çalışalım?</h2><p className="muted">Bir beceri seç, kaldığın yerden devam et.</p>
        <div className="quick-links">
          <Link href="/vocabulary"><span className="quick-link-icon">Aa</span><span><b>Kelime tekrarı</b><small>{due} kelime hazır</small></span><span className="quick-arrow">↗</span></Link>
          <Link href="/practice/lesen"><span className="quick-link-icon">文</span><span><b>Okuma pratiği</b><small>Metinlerle Almanca</small></span><span className="quick-arrow">↗</span></Link>
          <Link href="/exam"><span className="quick-link-icon">✓</span><span><b>Deneme sınavı</b><small>Goethe formatında</small></span><span className="quick-arrow">↗</span></Link>
        </div>
      </section>
    </div>

    {goethe?.weeks?.length > 0 && <section className="content-card goethe-card"><div className="section-heading"><div><span className="eyebrow">SINAV HAZIRLIĞI</span><h2>Goethe {goethe.exam_level} yol haritan</h2></div><Link href="/exam" className="text-link">Sınav pratiğine git →</Link></div><div className="goethe-weeks">{goethe.weeks.slice(0, 4).map((w: any) => <details key={w.week}><summary><span>0{w.week}</span><b>{w.focus}</b></summary><p>{(w.skills || []).join(" · ")}</p><p className="muted">{w.practice}</p></details>)}</div></section>}

    <div className="dashboard-columns">
      <section className="content-card skills-card"><div className="section-heading"><div><span className="eyebrow">SEVİYE TESPİTİ</span><h2>Beceri görünümü</h2></div><Link href="/progress" className="text-link">Tüm ilerleme →</Link></div><p className="muted">Son seviye tespitindeki sonuçların.</p>
        {Object.keys(SKILL_LABEL).map(k => <div className="skill-row" key={k}><div className="skill-label"><span>{SKILL_LABEL[k]}</span><b>{scores[k] == null ? "—" : `%${scores[k]}`}</b></div><div className="bar"><i style={{ width: `${scores[k] ?? 0}%` }} /></div></div>)}
      </section>
      <section className="content-card exam-card"><div className="section-heading"><div><span className="eyebrow">DENEME SONUÇLARI</span><h2>Son sınavların</h2></div></div>
        {(exams.data || []).length ? <ul className="exam-list">{(exams.data || []).map((e: any, i: number) => <li key={i}><span className="exam-score">%{e.pct}</span><span>{new Date(e.created_at).toLocaleDateString("tr-TR", { day: "numeric", month: "long" })}</span></li>)}</ul> : <p className="muted">Henüz deneme sınavı çözmedin. İlk denemenle seviyeni gör.</p>}
        <Link className="btn secondary-btn" href="/exam">Deneme sınavına geç <span aria-hidden="true">→</span></Link>
        {asm.data && <Link className="text-link retake-link" href="/assessment">Seviye tespitini tekrarla</Link>}
      </section>
    </div>
  </main>;
}
