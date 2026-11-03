"use client";
import { useState } from "react";
import Question, { type PQ } from "@/components/Question";
import { SKILL_LABEL } from "@/lib/scoring";

type Res = {
  level: string; summary: string; strengths: string[]; weaknesses: string[];
  scores: Record<string, number | null>; readiness: number;
  plan: { weekly_focus: string; summary: string; days: { day: string; focus: string; minutes: number }[]; goethe?: { exam_level: string; weeks: { week: number; focus: string; skills: string[]; practice: string }[] } };
};

export default function AssessmentClient({ questions, defaultMinutes }: { questions: PQ[]; defaultMinutes: number }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [intro, setIntro] = useState("");
  const [targetLevel, setTargetLevel] = useState<"A1" | "A2">("A2");
  const [examWeeks, setExamWeeks] = useState(12);
  const [goal, setGoal] = useState("Goethe sınavına hazırlanmak");
  const [minutes, setMinutes] = useState(defaultMinutes || 30);
  const [result, setResult] = useState<Res | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const answered = questions.filter(question => answers[question.id]).length;
  const progress = Math.round(answered / questions.length * 100);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, intro, goal, minutes, targetLevel, examWeeks })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setResult(data.assessment);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Bir hata oluştu.");
    } finally {
      setBusy(false);
    }
  }

  if (result) return <div className="assessment-result">
    <section className="panel result-summary-card">
      <span className="eyebrow">SEVİYE TESPİTİ TAMAMLANDI</span>
      <h2>Tahmini seviyen: {result.level}</h2>
      <p>{result.summary}</p>
      <p className="muted">Test başarı oranı: %{result.readiness}</p>
      {Object.keys(SKILL_LABEL).map(key => <div className="skill-row" key={key}>
        <div className="skill-label"><span>{SKILL_LABEL[key]}</span><b>{result.scores[key] == null ? "Bu testte ölçülmedi" : `%${result.scores[key]}`}</b></div>
        <div className="bar"><i style={{ width: `${result.scores[key] ?? 0}%` }} /></div>
      </div>)}
    </section>
    <div className="grid result-strengths">
      <section className="panel"><h3>Güçlü yönlerin</h3><ul>{result.strengths.map((strength, index) => <li key={index}>{strength}</li>)}</ul></section>
      <section className="panel"><h3>Geliştirilecek alanlar</h3><ul>{result.weaknesses.map((weakness, index) => <li key={index}>{weakness}</li>)}</ul></section>
    </div>
    <section className="panel"><span className="eyebrow">KİŞİSEL PROGRAMIN</span><h3>İlk hafta planın</h3><p>{result.plan.summary}</p>
      {result.plan.days.map(day => <p key={day.day}><b>{day.day}</b> — {day.focus} <span className="muted">({day.minutes} dk)</span></p>)}
    </section>
    {result.plan.goethe && <section className="panel"><span className="eyebrow">SINAV YOL HARİTASI</span><h3>Goethe {result.plan.goethe.exam_level} hazırlık programın</h3>
      {result.plan.goethe.weeks.map(week => <p key={week.week}><b>{week.week}. hafta</b> — {week.focus}<br /><span className="muted">{week.skills.join(" · ")} — {week.practice}</span></p>)}
    </section>}
    <a className="btn" href="/">Öğrenme paneline geç <span aria-hidden="true">→</span></a>
  </div>;

  return <form className="assessment-form" onSubmit={submit}>
    <section className="assessment-progress-card">
      <div className="assessment-progress-top">
        <div><span className="eyebrow">TEST İLERLEMESİ</span><p>Yanıtlanan sorular</p></div>
        <strong>{answered}<small> / {questions.length}</small></strong>
      </div>
      <div className="bar" role="progressbar" aria-label="Test ilerlemesi" aria-valuemin={0} aria-valuemax={questions.length} aria-valuenow={answered}><i style={{ width: `${progress}%` }} /></div>
      <p className="muted">Soruları yanıtla. Dinleme metinlerini istediğin kadar tekrar dinleyebilirsin.</p>
    </section>

    {questions.map((question, index) => <section className="panel question-card" key={question.id}>
      <p className="question-kicker">Soru {String(index + 1).padStart(2, "0")} <span>/ {questions.length}</span><span className="question-skill">{SKILL_LABEL[question.skill]}</span></p>
      <Question q={question} value={answers[question.id] || ""} onChange={value => setAnswers(current => ({ ...current, [question.id]: value }))} allowAskTeacher={false} />
    </section>)}

    <section className="panel assessment-final-card">
      <span className="eyebrow">SON ADIM</span><h2>Kendini kısaca tanıt</h2>
      <p className="muted">Almanca 3–5 cümle yazabilirsin. Adın, yaşın, yaşadığın yer, mesleğin ve hobilerinden bahset. İstersen boş bırak.</p>
      <div className="field"><label htmlFor="assessment-intro">Almanca tanıtım yazısı</label><textarea id="assessment-intro" value={intro} onChange={event => setIntro(event.target.value)} maxLength={3000} placeholder="Hallo! Ich heiße …" /></div>
      <div className="grid">
        <div className="field"><label htmlFor="target-level">Goethe hedef seviyesi</label><select id="target-level" value={targetLevel} onChange={event => setTargetLevel(event.target.value as "A1" | "A2")}><option value="A1">Goethe A1</option><option value="A2">Goethe A2</option></select></div>
        <div className="field"><label htmlFor="exam-weeks">Sınava kalan süre (hafta)</label><input id="exam-weeks" type="number" min={4} max={52} value={examWeeks} onChange={event => setExamWeeks(Number(event.target.value))} /></div>
        <div className="field"><label htmlFor="learning-goal">Öğrenme hedefin</label><input id="learning-goal" value={goal} onChange={event => setGoal(event.target.value)} maxLength={160} required /></div>
        <div className="field"><label htmlFor="daily-minutes">Günlük çalışma süresi (dk)</label><input id="daily-minutes" type="number" min={10} max={180} value={minutes} onChange={event => setMinutes(Number(event.target.value))} /></div>
      </div>
    </section>

    {error && <p className="error assessment-error" role="alert">{error}</p>}
    {busy && <p className="assessment-working" role="status"><span className="working-dot" /> Yanıtların değerlendiriliyor, kişisel programın hazırlanıyor. İşlem bir dakikaya kadar sürebilir.</p>}
    <button className="btn assessment-submit" disabled={busy || answered < questions.length}>
      {busy ? "Programın hazırlanıyor…" : answered < questions.length ? `${questions.length - answered} soru kaldı` : "Seviye testini tamamla"}
    </button>
  </form>;
}
