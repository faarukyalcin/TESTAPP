import { NextResponse } from "next/server";
import { apiContext } from "@/lib/auth";
import { askAI, parseAIJson, planSchema } from "@/lib/ai";
import { aiAllowed } from "@/lib/limit";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Planı gerçek ilerleme verisine göre günceller.
export async function POST() {
  const c = await apiContext();
  if (!c) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await aiAllowed(c.user.id, "plan", 5))) return NextResponse.json({ error: "Plan güncelleme sınırına ulaştın." }, { status: 429 });
  try {
    const a = supabaseAdmin();
    const [asm, attempts, exams, vocab, lessons, exercises] = await Promise.all([
      c.sb.from("assessments").select("level,input,weaknesses").eq("user_id", c.user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      c.sb.from("exercise_attempts").select("exercise_id,correct").eq("user_id", c.user.id).order("created_at", { ascending: false }).limit(300),
      c.sb.from("exam_results").select("pct,by_skill").eq("user_id", c.user.id).order("created_at", { ascending: false }).limit(5),
      c.sb.from("vocabulary_progress").select("learned,lapses").eq("user_id", c.user.id),
      c.sb.from("lesson_progress").select("lesson_id,score").eq("user_id", c.user.id),
      a.from("exercises").select("id,skill")
    ]);
    const skillOf = new Map((exercises.data || []).map((e: any) => [e.id, e.skill]));
    const acc: Record<string, { c: number; t: number }> = {};
    for (const r of attempts.data || []) { const k = skillOf.get(r.exercise_id) as string; if (!k) continue; (acc[k] ||= { c: 0, t: 0 }).t++; if (r.correct) acc[k].c++; }
    const data = {
      level: c.profile.cefr_level, target: c.profile.target_level, goal: c.profile.admin_goal || c.profile.learning_goal, dailyMinutes: c.profile.daily_minutes,
      placement: asm.data?.input?.scores, weaknesses: asm.data?.weaknesses, practiceAccuracy: acc, recentExams: exams.data,
      wordsLearned: (vocab.data || []).filter((v: any) => v.learned).length, hardWords: (vocab.data || []).filter((v: any) => v.lapses >= 2).length,
      lessonsDone: (lessons.data || []).length
    };
    const raw = await askAI("You are a German study planner for Turkish speakers (A1/A2). Using ONLY the real data given, return JSON: {weekly_focus,summary,daily_words,days:[{day,focus,minutes}],review_topics}. 7 days (Pazartesi..Pazar), minutes sum close to dailyMinutes*7 with at most one lighter day. Prioritise the weakest skills. Turkish text.", JSON.stringify(data), true);
    const plan = planSchema.parse(parseAIJson(raw));
    await a.from("learning_plans").update({ active: false }).eq("user_id", c.user.id);
    await a.from("learning_plans").insert({ user_id: c.user.id, plan });
    return NextResponse.json({ plan });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Plan oluşturulamadı." }, { status: 502 });
  }
}
