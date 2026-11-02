export const SKILL_LABEL: Record<string, string> = {
  lesen: "Lesen (Okuma)", horen: "Hören (Dinleme)", schreiben: "Schreiben (Yazma)", sprechen: "Sprechen (Konuşma)",
  grammatik: "Grammatik (Dil bilgisi)", wortschatz: "Wortschatz (Kelime)"
};
export type Q = { id: string; skill: string; level: string; grp: string | null; passage: string | null; audio_text: string | null; prompt: string; options: string[]; answer: string; explanation: string | null };

export const pct = (c: number, t: number) => (t > 0 ? Math.round((c / t) * 100) : 0);
export function shuffle<T>(a: T[], rnd = Math.random): T[] {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; }
  return x;
}
export function publicQ(q: Q) { const { answer: _a, explanation: _e, ...rest } = q; return { ...rest, options: shuffle(q.options) }; }

/** Seviye tespiti için soru seçimi: grammatik/wortschatz seviye başına 2 soru, lesen/horen seviye başına 1 metin (grup). */
export function pickAssessment(pool: Q[], rnd = Math.random): Q[] {
  const out: Q[] = [];
  for (const level of ["A1", "A2"]) {
    for (const skill of ["grammatik", "wortschatz"]) out.push(...shuffle(pool.filter(q => q.skill === skill && q.level === level), rnd).slice(0, 2));
    for (const skill of ["lesen", "horen"]) {
      const groups = [...new Set(pool.filter(q => q.skill === skill && q.level === level && q.grp).map(q => q.grp as string))];
      const g = shuffle(groups, rnd)[0];
      if (g) out.push(...pool.filter(q => q.grp === g));
    }
  }
  return out;
}

export function gradeAnswers(questions: Q[], answers: Record<string, string>) {
  const results = questions.map(q => ({ id: q.id, skill: q.skill, level: q.level, correct: (answers[q.id] ?? "") === q.answer, given: answers[q.id] ?? "", answer: q.answer, explanation: q.explanation }));
  const bySkill: Record<string, { c: number; t: number; pct: number }> = {};
  for (const r of results) { const s = (bySkill[r.skill] ||= { c: 0, t: 0, pct: 0 }); s.t++; if (r.correct) s.c++; }
  for (const s of Object.values(bySkill)) s.pct = pct(s.c, s.t);
  const score = results.filter(r => r.correct).length;
  return { results, bySkill, score, total: results.length, pct: pct(score, results.length) };
}

export function levelFromResults(results: { level: string; correct: boolean }[]): "A1" | "A2" {
  const rate = (lv: string) => { const r = results.filter(x => x.level === lv); return r.length ? r.filter(x => x.correct).length / r.length : 0; };
  return rate("A1") >= 0.7 && rate("A2") >= 0.5 ? "A2" : "A1";
}
export function goetheReadiness(p: number) {
  return p >= 75 ? "Sınava hazır görünüyorsun" : p >= 60 ? "Hazırlığın iyi, birkaç alan güçlendirilmeli" : "Daha çok hazırlık gerekiyor";
}
const TR_OFFSET = 3 * 3600_000;
export const dayKey = (ts: number | string | Date) => new Date(new Date(ts).getTime() + TR_OFFSET).toISOString().slice(0, 10);
export function streakFromDates(dates: string[], now = Date.now()) {
  const days = new Set(dates.map(dayKey));
  let streak = 0; let t = now;
  if (!days.has(dayKey(t))) t -= 86_400_000; // bugün henüz çalışmadıysa dünden say
  while (days.has(dayKey(t))) { streak++; t -= 86_400_000; }
  return streak;
}
