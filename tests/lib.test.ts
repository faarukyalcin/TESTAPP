import { describe, it, expect } from "vitest";
import { review } from "../lib/srs";
import { gradeAnswers, levelFromResults, pickAssessment, streakFromDates, pct, publicQ, type Q } from "../lib/scoring";

const mk = (id: string, skill: string, level: string, grp: string | null = null): Q => ({ id, skill, level, grp, passage: null, audio_text: null, prompt: "p", options: ["a", "b"], answer: "a", explanation: "e" });

describe("srs", () => {
  const base = { ease: 2.5, interval_days: 0, reps: 0, lapses: 0 };
  it("yanlış cevap aralığı sıfırlar ve ease düşürür", () => {
    const r = review({ ...base, reps: 3, interval_days: 10 }, 0, new Date("2026-01-01T00:00:00Z"));
    expect(r.reps).toBe(0); expect(r.lapses).toBe(1); expect(r.ease).toBeCloseTo(2.3); expect(r.due_at).toBe("2026-01-01T00:10:00.000Z");
  });
  it("art arda doğru cevapla aralık büyür", () => {
    let c = base as any; const seen: number[] = [];
    for (let i = 0; i < 4; i++) { const r = review(c, 2); seen.push(r.interval_days); c = r; }
    expect(seen).toEqual([1, 6, 15, 38]);
  });
  it("ease 1.3 altına düşmez, öğrenildi 6 gün üstünde", () => {
    let c = { ...base, ease: 1.35 } as any; c = review(c, 1); expect(c.ease).toBeGreaterThanOrEqual(1.3);
    expect(review({ ...base, reps: 1, interval_days: 1 }, 2).learned).toBe(true);
  });
});
describe("scoring", () => {
  it("cevapları doğru puanlar, boşları yanlış sayar", () => {
    const qs = [mk("1", "lesen", "A1"), mk("2", "lesen", "A1"), mk("3", "grammatik", "A2")];
    const g = gradeAnswers(qs, { "1": "a", "2": "b" });
    expect(g.score).toBe(1); expect(g.total).toBe(3); expect(g.pct).toBe(33); expect(g.bySkill.lesen.pct).toBe(50); expect(g.bySkill.grammatik.pct).toBe(0);
  });
  it("seviye kuralı: A1>=70% ve A2>=50% ise A2", () => {
    const r = (a1: boolean[], a2: boolean[]) => [...a1.map(c => ({ level: "A1", correct: c })), ...a2.map(c => ({ level: "A2", correct: c }))];
    expect(levelFromResults(r([true, true, true, false], [true, false]))).toBe("A2");
    expect(levelFromResults(r([true, false, false, false], [true, true]))).toBe("A1");
    expect(levelFromResults([])).toBe("A1");
  });
  it("publicQ cevabı ve açıklamayı sızdırmaz", () => {
    const x = publicQ(mk("1", "lesen", "A1")) as any; expect(x.answer).toBeUndefined(); expect(x.explanation).toBeUndefined(); expect(x.options.sort()).toEqual(["a", "b"]);
  });
  it("seviye testi seçimi: gruplar bütün kalır", () => {
    const pool: Q[] = [];
    for (const lv of ["A1", "A2"]) { for (const sk of ["grammatik", "wortschatz"]) for (let i = 0; i < 4; i++) pool.push(mk(`${sk}${lv}${i}`, sk, lv));
      for (const sk of ["lesen", "horen"]) for (const g of [1, 2]) for (let i = 0; i < 2; i++) pool.push(mk(`${sk}${lv}${g}${i}`, sk, lv, `${sk}-${lv}-${g}`)); }
    const t = pickAssessment(pool);
    expect(t.length).toBe(2 * (2 + 2 + 2 + 2)); expect(new Set(t.map(q => q.id)).size).toBe(t.length);
    for (const g of new Set(t.filter(q => q.grp).map(q => q.grp))) expect(t.filter(q => q.grp === g).length).toBe(2);
  });
  it("seri hesabı", () => {
    const now = Date.parse("2026-03-10T12:00:00Z"); const d = (n: number) => new Date(now - n * 86_400_000).toISOString();
    expect(streakFromDates([d(0), d(1), d(2), d(4)], now)).toBe(3);
    expect(streakFromDates([d(1), d(2)], now)).toBe(2);
    expect(streakFromDates([d(3)], now)).toBe(0);
    expect(pct(1, 3)).toBe(33);
  });
});
