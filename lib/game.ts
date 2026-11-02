import { supabaseAdmin } from "@/lib/supabase/admin";
import { streakFromDates } from "@/lib/scoring";

export const ACHIEVEMENTS: Record<string, string> = {
  first_lesson: "İlk ders tamamlandı", first_exam: "İlk deneme sınavı", first_writing: "İlk yazma ödevi",
  words_25: "25 kelime öğrenildi", streak_3: "3 günlük seri", streak_7: "7 günlük seri"
};

export async function award(userId: string, xp: number) {
  const a = supabaseAdmin();
  const { data } = await a.from("profiles").select("xp").eq("id", userId).single();
  await a.from("profiles").update({ xp: (data?.xp ?? 0) + xp }).eq("id", userId);
  await checkAchievements(userId);
}

export async function checkAchievements(userId: string) {
  const a = supabaseAdmin();
  const cnt = async (t: string, extra?: (q: any) => any) => { let q = a.from(t).select("*", { count: "exact", head: true }).eq("user_id", userId); if (extra) q = extra(q); const { count } = await q; return count ?? 0; };
  const [lessons, exams, writings, words, dates, have] = await Promise.all([
    cnt("lesson_progress"), cnt("exam_results"), cnt("writing_submissions"),
    cnt("vocabulary_progress", q => q.eq("learned", true)),
    a.from("study_sessions").select("created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(400),
    a.from("achievements").select("code").eq("user_id", userId)
  ]);
  const streak = streakFromDates((dates.data || []).map((d: any) => d.created_at));
  const earned: string[] = [];
  if (lessons >= 1) earned.push("first_lesson");
  if (exams >= 1) earned.push("first_exam");
  if (writings >= 1) earned.push("first_writing");
  if (words >= 25) earned.push("words_25");
  if (streak >= 3) earned.push("streak_3");
  if (streak >= 7) earned.push("streak_7");
  const owned = new Set((have.data || []).map((r: any) => r.code));
  const fresh = earned.filter(c => !owned.has(c));
  if (!fresh.length) return;
  await a.from("achievements").upsert(fresh.map(code => ({ user_id: userId, code })), { onConflict: "user_id,code", ignoreDuplicates: true });
  await a.from("notifications").insert(fresh.map(code => ({ user_id: userId, title: "Yeni rozet 🏅", body: ACHIEVEMENTS[code], kind: "achievement" })));
}
