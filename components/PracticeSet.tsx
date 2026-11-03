"use client";

import { useState } from "react";
import Question, { type PQ } from "@/components/Question";

type R = { correct: boolean; answer: string; explanation: string | null };
type PracticeSetProps = { questions: PQ[]; variant?: "default" | "grammar" };

export default function PracticeSet({ questions, variant = "default" }: PracticeSetProps) {
  const [index, setIndex] = useState(0);
  const [value, setValue] = useState("");
  const [result, setResult] = useState<R | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const done = index >= questions.length;
  const grammarMode = variant === "grammar";

  async function check() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/exercise/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: questions[index].id, answer: value })
      });
      const data = await response.json().catch(() => ({})) as Partial<R> & { error?: string };
      if (!response.ok || typeof data.correct !== "boolean") {
        throw new Error(data.error || "Cevap kontrol edilemedi. Tekrar dene.");
      }
      const checked = data as R;
      setResult(checked);
      if (checked.correct) setCorrectCount(count => count + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cevap kontrol edilemedi.");
    } finally {
      setBusy(false);
    }
  }

  function restart() {
    setIndex(0);
    setCorrectCount(0);
    setResult(null);
    setValue("");
    setError("");
  }

  if (!questions.length) return <p className="muted">Bu bölüm için henüz soru yok.</p>;

  if (done) {
    const percentage = Math.round((correctCount / questions.length) * 100);
    if (grammarMode) return <section className="grammar-practice-card grammar-practice-result" aria-live="polite">
      <span className="grammar-result-mark" aria-hidden="true">{percentage >= 70 ? "✓" : "↻"}</span>
      <span className="eyebrow">ALIŞTIRMA TAMAMLANDI</span>
      <h3>{percentage >= 70 ? "Güzel ilerleme." : "Bir tur daha çalışalım."}</h3>
      <p>Bu konuda <b>{questions.length}</b> sorudan <b>{correctCount}</b> tanesini doğru yanıtladın.</p>
      <div className="grammar-result-meter" role="progressbar" aria-label="Alıştırma başarı oranı" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage}><i style={{ width: `${percentage}%` }} /></div>
      <strong className="grammar-result-score">%{percentage}</strong>
      <div className="grammar-result-actions"><button className="btn" onClick={restart}>Tekrar çöz</button><a className="btn ghost" href="/grammar">Konu listesine dön</a></div>
    </section>;
    return <section className="panel"><h2>Bitti 🎉</h2><p className="stat">{correctCount} / {questions.length}</p><button className="btn" onClick={restart}>Tekrar çöz</button></section>;
  }

  const question = questions[index];
  const progress = Math.round((index / questions.length) * 100);

  if (grammarMode) return <section className="grammar-practice-card">
    <header className="grammar-question-progress">
      <div><span className="grammar-aside-kicker">SORU {String(index + 1).padStart(2, "0")} / {String(questions.length).padStart(2, "0")}</span><b>{correctCount} doğru</b></div>
      <div className="grammar-practice-meter" role="progressbar" aria-label="Alıştırma ilerlemesi" aria-valuemin={0} aria-valuemax={questions.length} aria-valuenow={index}><i style={{ width: `${progress}%` }} /></div>
    </header>
    <div className="grammar-question-body">
      <Question q={question} value={value} onChange={setValue} locked={!!result} answer={result?.answer} explanation={result?.explanation} />
    </div>
    {error && <p role="alert" className="grammar-practice-error">{error}</p>}
    {result && <div className={`grammar-answer-feedback ${result.correct ? "correct" : "incorrect"}`} role="status">
      <span aria-hidden="true">{result.correct ? "✓" : "!"}</span><p><b>{result.correct ? "Doğru cevap" : `Doğru yanıt: ${result.answer}`}</b>{result.explanation && <small>{result.explanation}</small>}</p>
    </div>}
    <footer className="grammar-question-actions">
      <span className="muted">{result ? "Yanıtın kaydedildi." : "Bir seçenek belirle ve cevabını kontrol et."}</span>
      {!result ? <button className="btn" disabled={!value || busy} onClick={check}>{busy ? "Kontrol ediliyor…" : "Cevabımı kontrol et"}</button>
        : <button className="btn" onClick={() => { setIndex(current => current + 1); setValue(""); setResult(null); setError(""); }}>{index + 1 === questions.length ? "Sonucu gör" : "Sonraki soru"} <span aria-hidden="true">→</span></button>}
    </footer>
  </section>;

  return <section className="panel">
    <p className="muted">Soru {index + 1} / {questions.length}</p>
    <Question q={question} value={value} onChange={setValue} locked={!!result} answer={result?.answer} explanation={result?.explanation} />
    {error && <p className="error">{error}</p>}
    {result && <p className={result.correct ? "ok" : "error"}>{result.correct ? "Doğru ✓" : `Yanlış. Doğru cevap: ${result.answer}`}<br /><span className="muted">{result.explanation}</span>{question.audio_text && <><br /><span className="muted">Metin: {question.audio_text}</span></>}</p>}
    {!result ? <button className="btn" disabled={!value || busy} onClick={check}>{busy ? "Kontrol ediliyor…" : "Kontrol et"}</button>
      : <button className="btn" onClick={() => { setIndex(current => current + 1); setValue(""); setResult(null); }}>{index + 1 === questions.length ? "Bitir" : "Sonraki →"}</button>}
  </section>;
}
