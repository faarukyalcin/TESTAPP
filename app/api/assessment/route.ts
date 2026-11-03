import { NextResponse } from "next/server";
import { z } from "zod";
import { apiContext } from "@/lib/auth";
import { askAI, assessmentAISchema, parseAIJson } from "@/lib/ai";
import { aiAllowed } from "@/lib/limit";
import { loadByIds } from "@/lib/server-data";
import { gradeAnswers, levelFromResults, pct } from "@/lib/scoring";
import { supabaseAdmin } from "@/lib/supabase/admin";

const body = z.object({
  answers: z.record(z.string(), z.string().max(300)),
  intro: z.string().max(3000).default(""),
  goal: z.string().max(160),
  minutes: z.number().int().min(10).max(180),
  targetLevel: z.enum(["A1", "A2"]).default("A2"),
  examWeeks: z.number().int().min(4).max(52).default(12)
});

export async function POST(req: Request) {
  const c = await apiContext();
  if (!c) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Geçersiz veri" }, { status: 400 });
  const { answers, intro, goal, minutes, targetLevel, examWeeks } = parsed.data;
  const ids = Object.keys(answers);
  if (ids.length < 10) return NextResponse.json({ error: "Lütfen soruların tümünü yanıtla." }, { status: 400 });
  if (!(await aiAllowed(c.user.id, "assessment", 6))) return NextResponse.json({ error: "Çok sık deneme yaptın. Biraz sonra tekrar dene." }, { status: 429 });

  // Puanlama sunucuda ve deterministik yapılır; AI yalnızca yorum ve plan üretir.
  const qs = (await loadByIds(ids)).filter(q => q.id.startsWith("pool-"));
  if (qs.length !== ids.length) return NextResponse.json({ error: "Geçersiz soru." }, { status: 400 });
  const g = gradeAnswers(qs, answers);
  const level = levelFromResults(g.results);
  const scores: Record<string, number | null> = {
    lesen: g.bySkill.lesen?.pct ?? null, horen: g.bySkill.horen?.pct ?? null,
    grammatik: g.bySkill.grammatik?.pct ?? null, wortschatz: g.bySkill.wortschatz?.pct ?? null,
    schreiben: null, sprechen: null
  };
  try {
    const raw = await askAI(
      `You are a cautious German placement tutor for Turkish speakers. The assessed current level is ${level}; do not change it. The student's Goethe goal is ${targetLevel}. Return JSON only: {level:"${level}",summary,writing_score,strengths,weaknesses,plan:{weekly_focus,summary,daily_words,days:[{day,focus,minutes}],review_topics,goethe:{exam_level:"${targetLevel}",weeks:[{week,focus,skills,practice}]}}}. Make exactly 7 daily plan entries. Build a realistic ${examWeeks}-week Goethe ${targetLevel} preparation roadmap, with separate Hören, Lesen, Schreiben and Sprechen practice across the weeks, mock tests and review. writing_score is 0-100 for the German self-introduction (null if empty). Speaking was not tested orally; say so honestly. Explain results in Turkish.`,
      JSON.stringify({ level, targetLevel, examWeeks, scores, bySkill: g.bySkill, intro, goal, minutes }), true, c.user.id, c.sb);
    const ai = assessmentAISchema.parse(parseAIJson(raw));
    scores.schreiben = intro.trim() ? ai.writing_score : null;
    const input = { goal, minutes, targetLevel, examWeeks, scores, intro, answered: ids.length, total: g.total, score: g.score };
    const a = supabaseAdmin();
    const { data: row, error } = await a.from("assessments").insert({ user_id: c.user.id, level, input, strengths: ai.strengths, weaknesses: ai.weaknesses, plan: ai.plan, summary: ai.summary }).select("id").single();
    if (error) throw error;
    await a.from("learning_plans").update({ active: false }).eq("user_id", c.user.id);
    await a.from("learning_plans").insert({ user_id: c.user.id, assessment_id: row.id, plan: ai.plan });
    await a.from("profiles").update({ cefr_level: level, learning_goal: goal, daily_minutes: minutes, target_level: targetLevel }).eq("id", c.user.id);
    const readiness = pct(g.score, g.total);
    return NextResponse.json({ assessment: { level, summary: ai.summary, strengths: ai.strengths, weaknesses: ai.weaknesses, plan: ai.plan, scores, readiness, details: g.results.map(r => ({ id: r.id, correct: r.correct, explanation: r.explanation })) } });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "AI servisi yanıt vermedi. API anahtarını ve sağlayıcı ayarını kontrol et." }, { status: 502 });
  }
}

