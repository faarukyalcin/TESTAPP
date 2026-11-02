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
  minutes: z.number().int().min(10).max(180)
});

export async function POST(req: Request) {
  const c = await apiContext();
  if (!c) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Geçersiz veri" }, { status: 400 });
  const { answers, intro, goal, minutes } = parsed.data;
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
      `You are a cautious German placement tutor for Turkish speakers. The CEFR level is ALREADY decided: ${level}; do not change it. Return JSON only: {summary,writing_score,strengths,weaknesses,plan:{weekly_focus,summary,daily_words,days:[{day,focus,minutes}],review_topics}}. writing_score is 0-100 for the student's German self-introduction (null if empty), judging grammar, vocabulary and fit for A1/A2. days must cover 7 days (Pazartesi..Pazpazar) and match the daily minutes. Speaking and listening were not tested orally; say so honestly. Answer in Turkish.`,
      JSON.stringify({ level, scores, bySkill: g.bySkill, intro, goal, minutes }), true);
    const ai = assessmentAISchema.parse(parseAIJson(raw));
    scores.schreiben = intro.trim() ? ai.writing_score : null;
    const input = { goal, minutes, scores, intro, answered: ids.length, total: g.total, score: g.score };
    const a = supabaseAdmin();
    const { data: row, error } = await a.from("assessments").insert({ user_id: c.user.id, level, input, strengths: ai.strengths, weaknesses: ai.weaknesses, plan: ai.plan, summary: ai.summary }).select("id").single();
    if (error) throw error;
    await a.from("learning_plans").update({ active: false }).eq("user_id", c.user.id);
    await a.from("learning_plans").insert({ user_id: c.user.id, assessment_id: row.id, plan: ai.plan });
    await a.from("profiles").update({ cefr_level: level, learning_goal: goal, daily_minutes: minutes }).eq("id", c.user.id);
    const readiness = pct(g.score, g.total);
    return NextResponse.json({ assessment: { level, summary: ai.summary, strengths: ai.strengths, weaknesses: ai.weaknesses, plan: ai.plan, scores, readiness, details: g.results.map(r => ({ id: r.id, correct: r.correct, explanation: r.explanation })) } });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "AI servisi yanıt vermedi. API anahtarını ve sağlayıcı ayarını kontrol et." }, { status: 502 });
  }
}
