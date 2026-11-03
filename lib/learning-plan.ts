import type { Profile } from "@/lib/auth";
import { askAI, parseAIJson, planSchema } from "@/lib/ai";
import { aiAllowed } from "@/lib/limit";
import { supabaseAdmin } from "@/lib/supabase/admin";

export class LearningPlanError extends Error {
  constructor(message: string, readonly status = 502) { super(message); }
}

export async function buildAndActivateLearningPlan(userId: string, profile: Profile, sb: any, options: { dailyMinutesOverride?: number } = {}) {
  if (!(await aiAllowed(userId, "plan", 5))) throw new LearningPlanError("Plan yenileme sınırına ulaştın. Biraz sonra tekrar dene.", 429);

  const admin = supabaseAdmin();
  const [assessment, attempts, exams, vocabulary, lessons, exerciseRows, current] = await Promise.all([
    sb.from("assessments").select("level,input,weaknesses").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    sb.from("exercise_attempts").select("exercise_id,correct").eq("user_id", userId).order("created_at", { ascending: false }).limit(300),
    sb.from("exam_results").select("pct,by_skill").eq("user_id", userId).order("created_at", { ascending: false }).limit(5),
    sb.from("vocabulary_progress").select("learned,lapses").eq("user_id", userId),
    sb.from("lesson_progress").select("lesson_id,score").eq("user_id", userId),
    admin.from("exercises").select("id,skill"),
    sb.from("learning_plans").select("plan").eq("user_id", userId).eq("active", true).order("created_at", { ascending: false }).limit(1).maybeSingle()
  ]);

  const skillOf = new Map((exerciseRows.data || []).map((exercise: any) => [exercise.id, exercise.skill]));
  const practiceAccuracy: Record<string, { correct: number; total: number }> = {};
  for (const attempt of attempts.data || []) {
    const skill = skillOf.get(attempt.exercise_id) as string | undefined;
    if (!skill) continue;
    (practiceAccuracy[skill] ||= { correct: 0, total: 0 }).total++;
    if (attempt.correct) practiceAccuracy[skill].correct++;
  }

  const dailyMinutes = options.dailyMinutesOverride ?? profile.daily_minutes;
  const data = {
    level: profile.cefr_level || "A1", target: profile.target_level,
    goal: profile.admin_goal || profile.learning_goal || "Almanca öğrenmek", dailyMinutes,
    placement: assessment.data?.input?.scores || null, weaknesses: assessment.data?.weaknesses || [],
    practiceAccuracy, recentExams: exams.data || [],
    wordsLearned: (vocabulary.data || []).filter((word: any) => word.learned).length,
    hardWords: (vocabulary.data || []).filter((word: any) => word.lapses >= 2).length,
    lessonsDone: (lessons.data || []).length,
    currentPlan: current.data?.plan ? {
      weekly_focus: current.data.plan.weekly_focus,
      days: (current.data.plan.days || []).map((day: any) => ({ day: day.day, focus: day.focus }))
    } : null
  };

  let plan;
  try {
    const raw = await askAI(
      "You are a German and Goethe exam planner for Turkish A1/A2 learners. Using only the real data given, return JSON matching {weekly_focus,summary,daily_words,days:[{day,focus,minutes}],review_topics,goethe:{exam_level,weeks:[{week,focus,skills,practice}]}}. Include exactly 7 daily entries, use target level A1/A2, and make a realistic 12-week Goethe roadmap rotating Hören, Lesen, Schreiben, Sprechen, mock exams and review. Prioritise measured weaknesses and adapt the current plan: change the sequence or emphasis, keep useful parts only when progress data supports them. Explain in Turkish.",
      JSON.stringify(data), true, userId, sb, "jarvis"
    );
    plan = planSchema.parse(parseAIJson(raw));
  } catch (error) {
    console.error("Learning plan generation failed", error);
    throw new LearningPlanError("Yeni program hazırlanamadı. Mevcut programın korunuyor; biraz sonra tekrar dene.");
  }

  if (options.dailyMinutesOverride != null) {
    const { error } = await sb.from("profiles").update({ daily_minutes: options.dailyMinutesOverride }).eq("id", userId);
    if (error) {
      console.error("Daily study goal update failed", error);
      throw new LearningPlanError("Yeni program hazırlandı ama günlük hedef kaydedilemedi. Eski hedef ve program korunuyor.", 500);
    }
  }

  const { data: created, error: insertError } = await admin.from("learning_plans")
    .insert({ user_id: userId, plan, active: true }).select("id").single();
  if (insertError || !created?.id) {
    console.error("Learning plan save failed", insertError);
    if (options.dailyMinutesOverride != null) {
      const { error: rollbackError } = await sb.from("profiles").update({ daily_minutes: profile.daily_minutes }).eq("id", userId);
      if (rollbackError) console.error("Daily study goal rollback failed", rollbackError);
    }
    throw new LearningPlanError("Yeni program sisteme kaydedilemedi. Mevcut programın korunuyor.");
  }

  const { error: deactivateError } = await admin.from("learning_plans")
    .update({ active: false }).eq("user_id", userId).neq("id", created.id);
  if (deactivateError) console.error("Previous plans could not be deactivated", deactivateError);

  return { plan, dailyMinutes };
}
