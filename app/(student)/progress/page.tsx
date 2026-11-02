import { requireStudent } from "@/lib/auth";
import { SKILL_LABEL, dayKey, pct } from "@/lib/scoring";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ACHIEVEMENTS } from "@/lib/game";

export default async function Progress() {
  const { sb, user, profile } = await requireStudent();
  const [study, attempts, exams, writing, voice, ach, ex] = await Promise.all([
    sb.from("study_sessions").select("seconds,created_at").eq("user_id", user.id).gte("created_at", new Date(Date.now() - 8 * 86_400_000).toISOString()),
    sb.from("exercise_attempts").select("exercise_id,correct").eq("user_id", user.id).order("created_at", { ascending: false }).limit(500),
    sb.from("exam_results").select("pct,created_at").eq("user_id", user.id).order("created_at", { ascending: true }).limit(12),
    sb.from("writing_submissions").select("score").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
    sb.from("voice_sessions").select("avg_confidence").eq("user_id", user.id).not("avg_confidence", "is", null).order("created_at", { ascending: false }).limit(10),
    sb.from("achievements").select("code").eq("user_id", user.id),
    supabaseAdmin().from("exercises").select("id,skill")
  ]);
  const skillOf = new Map((ex.data || []).map((e: any) => [e.id, e.skill as string]));
  const acc: Record<string, { c: number; t: number }> = {};
  for (const a of attempts.data || []) { const k = skillOf.get(a.exercise_id); if (!k) continue; (acc[k] ||= { c: 0, t: 0 }).t++; if (a.correct) acc[k].c++; }
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
  const skills: Record<string, number | null> = {
    lesen: acc.lesen ? pct(acc.lesen.c, acc.lesen.t) : null, horen: acc.horen ? pct(acc.horen.c, acc.horen.t) : null,
    grammatik: acc.grammatik ? pct(acc.grammatik.c, acc.grammatik.t) : null, wortschatz: acc.wortschatz ? pct(acc.wortschatz.c, acc.wortschatz.t) : null,
    schreiben: avg((writing.data || []).map((w: any) => w.score)), sprechen: avg((voice.data || []).map((v: any) => Math.round(v.avg_confidence * 100)))
  };
  const days = Array.from({ length: 7 }, (_, n) => dayKey(Date.now() - (6 - n) * 86_400_000));
  const mins = days.map(d => Math.round((study.data || []).filter((s: any) => dayKey(s.created_at) === d).reduce((a: number, s: any) => a + s.seconds, 0) / 60));
  const max = Math.max(profile.daily_minutes, ...mins, 1);
  const ep = (exams.data || []).map((e: any) => e.pct as number);
  const pts = ep.map((p, n) => `${ep.length === 1 ? 150 : 10 + (n * 280) / (ep.length - 1)},${110 - p}`).join(" ");
  return <main className="wrap"><h1>İlerleme</h1>
    <section className="panel"><h2>Son 7 gün (dakika)</h2><svg viewBox="0 0 320 130" role="img" aria-label="Haftalık çalışma süresi" style={{ width: "100%", maxWidth: 520 }}>
      {mins.map((m, n) => <g key={n}><rect x={14 + n * 44} y={100 - (m / max) * 90} width="28" height={(m / max) * 90} rx="4" fill="#3b82f6" /><text x={28 + n * 44} y="116" fontSize="10" textAnchor="middle" fill="currentColor">{days[n].slice(8)}</text><text x={28 + n * 44} y={96 - (m / max) * 90} fontSize="10" textAnchor="middle" fill="currentColor">{m || ""}</text></g>)}</svg>
      <p className="muted">Günlük hedef: {profile.daily_minutes} dk</p></section>
    <section className="panel"><h2>Beceri performansı</h2><p className="muted">Alıştırma, ders ve sınav cevaplarından; yazma ve konuşma ödev/oturum ortalamasından hesaplanır.</p>
      {Object.keys(SKILL_LABEL).map(k => <div key={k} style={{ margin: "10px 0" }}><div style={{ display: "flex", justifyContent: "space-between" }}><span>{SKILL_LABEL[k]}</span><span className="muted">{skills[k] == null ? "Veri yok" : `%${skills[k]}`}</span></div><div className="bar"><i style={{ width: `${skills[k] ?? 0}%` }} /></div></div>)}
      <p className="muted">Sprechen: tarayıcı konuşma tanıma güveninin ortalamasıdır.</p></section>
    <section className="panel"><h2>Deneme sınavı gelişimi</h2>{ep.length ? <svg viewBox="0 0 300 120" style={{ width: "100%", maxWidth: 520 }} role="img" aria-label="Sınav sonuçları"><polyline fill="none" stroke="#3b82f6" strokeWidth="3" points={pts} />{ep.map((p, n) => <circle key={n} cx={ep.length === 1 ? 150 : 10 + (n * 280) / (ep.length - 1)} cy={110 - p} r="4" fill="#3b82f6"><title>%{p}</title></circle>)}</svg> : <p className="muted">Henüz deneme sınavı yok.</p>}</section>
    <section className="panel"><h2>Rozetler · {profile.xp} XP</h2>{(ach.data || []).length ? (ach.data || []).map((a: any) => <span key={a.code} className="tag">🏅 {ACHIEVEMENTS[a.code] || a.code}</span>) : <p className="muted">Henüz rozet yok. Ders, sınav ve kelime çalıştıkça kazanırsın.</p>}</section>
  </main>;
}
