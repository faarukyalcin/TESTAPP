// Aralıklı tekrar (SM-2 türevi). grade: 0=Bilmiyorum, 1=Zor, 2=İyi, 3=Kolay
export type Card = { ease: number; interval_days: number; reps: number; lapses: number };
export type Grade = 0 | 1 | 2 | 3;
export function review(c: Card, g: Grade, now = new Date()) {
  let { ease, interval_days, reps, lapses } = c;
  let due: Date;
  if (g === 0) {
    reps = 0; lapses += 1; interval_days = 0; ease = Math.max(1.3, ease - 0.2);
    due = new Date(now.getTime() + 10 * 60_000);
  } else {
    reps += 1;
    if (reps === 1) interval_days = g === 3 ? 3 : 1;
    else if (reps === 2) interval_days = g === 1 ? 3 : g === 3 ? 8 : 6;
    else interval_days = Math.round(interval_days * ease * (g === 1 ? 0.8 : g === 3 ? 1.3 : 1));
    interval_days = Math.max(1, interval_days);
    ease = Math.max(1.3, ease + (g === 1 ? -0.15 : g === 3 ? 0.15 : 0));
    due = new Date(now.getTime() + interval_days * 86_400_000);
  }
  return { ease, interval_days, reps, lapses, due_at: due.toISOString(), learned: interval_days >= 6 };
}
