"use client";
import { useState } from "react";
import AskTeacher from "@/components/AskTeacher";

type Lesson = { title: string; goal: string; explanation: string; vocabulary: { german: string; turkish: string; example: string }[]; grammar: { title: string; explanation: string; examples: string[] }; reading: { text: string; instruction: string }; exercises: { type: string; prompt: string }[]; speaking: string };
type Grade = { score: number; feedback: string; corrections: { original: string; corrected: string; explanation: string }[]; next_focus: string };
export default function AILesson() {
  const [topic, setTopic] = useState(""); const [id, setId] = useState(""); const [level, setLevel] = useState("");
  const [lesson, setLesson] = useState<Lesson | null>(null); const [answers, setAnswers] = useState<string[]>([]); const [translation, setTranslation] = useState("");
  const [grade, setGrade] = useState<Grade | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function generate(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(""); setGrade(null); setLesson(null); setTranslation("");
    try { const r = await fetch("/api/ai-lesson", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic }) }); const d = await r.json(); if (!r.ok) throw new Error(d.error); setId(d.id); setLevel(d.level); setLesson(d.lesson); setAnswers(d.lesson.exercises.map(() => "")); }
    catch (e) { setError(e instanceof Error ? e.message : "Ders üretilemedi."); } finally { setBusy(false); }
  }
  async function submit() {
    if (!lesson || !id) return; setBusy(true); setError("");
    try { const r = await fetch("/api/ai-lesson", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lessonId: id, answers, translation }) }); const d = await r.json(); if (!r.ok) throw new Error(d.error); setGrade(d); }
    catch (e) { setError(e instanceof Error ? e.message : "Değerlendirme yapılamadı."); } finally { setBusy(false); }
  }
  return <section className="panel"><h2>AI ile sana özel ders</h2>
    <p className="muted">Bağladığın AI öğretmen, seviye tespitindeki güçlü/zayıf yönlerine göre yeni ders, kelime ve gramer pratiği hazırlar. Yanıtlarını öğretmenin değerlendirir ve düzeltir.</p>
    <form onSubmit={generate}><div className="field"><label>Ders konusu</label><input value={topic} onChange={e => setTopic(e.target.value)} placeholder="Ör. günlük rutin, Akkusativ, restoranda sipariş" minLength={2} maxLength={100} required /></div><button className="btn" disabled={busy}>{busy ? "AI öğretmenin ders hazırlıyor…" : "Kişisel ders oluştur"}</button></form>
    {error && <p className="error">{error}</p>}
    {lesson && <article style={{ marginTop: 24 }}><p><span className="tag">{level}</span></p><h3>{lesson.title}</h3><p><b>Hedef:</b> {lesson.goal}</p><p>{lesson.explanation}</p>
      <h3>Kelimeler</h3><ul>{lesson.vocabulary.map((v, i) => <li key={i}><b>{v.german}</b> — {v.turkish}<br/><span className="muted">{v.example}</span></li>)}</ul>
      <h3>{lesson.grammar.title}</h3><p>{lesson.grammar.explanation}</p><ul>{lesson.grammar.examples.map((x, i) => <li key={i}>{x}</li>)}</ul>
      <h3>Lesen ve çeviri</h3><div className="passage">{lesson.reading.text}</div><div className="field"><label>{lesson.reading.instruction}</label><textarea value={translation} onChange={e => setTranslation(e.target.value)} maxLength={2000} /><AskTeacher data={{ prompt: lesson.reading.instruction, passage: lesson.reading.text.slice(0, 1500), options: [], selected: translation, skill: "lesen / çeviri" }} /></div>
      <h3>Karışık alıştırmalar</h3>{lesson.exercises.map((x, i) => <div className="field" key={i}><label>{i + 1}. <span className="tag">{x.type}</span> {x.prompt}</label><textarea value={answers[i]} onChange={e => setAnswers(a => a.map((v, j) => j === i ? e.target.value : v))} maxLength={1000} /><AskTeacher data={{ prompt: `${x.type}: ${x.prompt}`, passage: null, options: [], selected: answers[i], skill: "AI ders alıştırması" }} /></div>)}
      <button className="btn" disabled={busy || !translation.trim() || answers.some(a => !a.trim())} onClick={submit}>{busy ? "Öğretmen değerlendiriyor…" : "Yanıtlarımı değerlendir"}</button>
      <h3>Konuşma görevi</h3><p>{lesson.speaking}</p>
      {grade && <section className="panel"><p className="stat">AI değerlendirmesi: %{grade.score}</p><p>{grade.feedback}</p>{grade.corrections.map((c, i) => <p key={i}><span className="error">{c.original}</span> → <b>{c.corrected}</b><br/><span className="muted">{c.explanation}</span></p>)}<p><b>Sonraki odak:</b> {grade.next_focus}</p></section>}
    </article>}
  </section>;
}
