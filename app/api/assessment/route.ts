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
    let ai: ReturnType<typeof assessmentAISchema.parse>;
    let aiFallback = false;
    try {
      const raw = await askAI(
        `You are a cautious German placement tutor for Turkish speakers. The assessed current level is ${level}; do not change it. The student's Goethe goal is ${targetLevel}. Return JSON only: {level:"${level}",summary,writing_score,strengths,weaknesses,plan:{weekly_focus,summary,daily_words,days:[{day,focus,minutes}],review_topics,goethe:{exam_level:"${targetLevel}",weeks:[{week,focus,skills,practice}]}}}. Make exactly 7 daily plan entries. Build a realistic ${examWeeks}-week Goethe ${targetLevel} preparation roadmap, with separate Hören, Lesen, Schreiben and Sprechen practice across the weeks, mock tests and review. writing_score is 0-100 for the German self-introduction (null if empty). Speaking was not tested orally; say so honestly. Explain results in Turkish.`,
        JSON.stringify({ level, targetLevel, examWeeks, scores, bySkill: g.bySkill, intro, goal, minutes }), true, c.user.id, c.sb);
      ai = assessmentAISchema.parse(parseAIJson(raw));
    } catch (aiError) {
      // A provider outage must not trap the learner at the assessment screen.
      // Preserve the deterministic placement result and provide an actionable starter plan.
      aiFallback = true;
      const focus = [
        ["lesen", "Lesen", scores.lesen],
        ["horen", "Hören", scores.horen],
        ["grammatik", "Grammatik", scores.grammatik],
        ["wortschatz", "Kelime", scores.wortschatz]
      ].sort((a, b) => Number(a[2] ?? 0) - Number(b[2] ?? 0));
      const weekCount = Math.max(4, examWeeks);
      const skills = ["Hören", "Lesen", "Schreiben", "Sprechen"];
      ai = assessmentAISchema.parse({
        summary: `Seviye tespit sonucuna göre mevcut seviyen ${level}. AI sağlayıcısı şu anda yanıt vermediği için bu başlangıç planı sınav puanlarına göre hazırlandı; derslerden AI desteğini daha sonra kullanabilirsin.`,
        writing_score: null,
        strengths: focus.slice(-2).map((item) => `${item[1]} alanında diğer alanlara göre daha güçlü sonuç.`),
        weaknesses: focus.slice(0, 2).map((item) => `${item[1]} çalışmasına öncelik ver.`),
        plan: {
          weekly_focus: `${focus[0][1]} ve Goethe ${targetLevel} hazırlığı`,
          summary: `Her gün ${minutes} dakika çalış. Önceliği ${focus[0][1]} ve ${focus[1][1]} alanlarına ver; haftalık Goethe hazırlığını ${targetLevel} hedefine göre sürdür.`,
          daily_words: 10,
          days: [
            { day: "Pazartesi", focus: "Kelime tekrarı ve kısa dinleme", minutes },
            { day: "Salı", focus: `${focus[0][1]} çalışması ve alıştırmalar`, minutes },
            { day: "Çarşamba", focus: "Dil bilgisi ve örnek cümleler", minutes },
            { day: "Perşembe", focus: "Okuma ve metin anlama", minutes },
            { day: "Cuma", focus: "Kısa yazma ve kendini tanıtma", minutes },
            { day: "Cumartesi", focus: "Konuşma kalıpları ve sesli tekrar", minutes },
            { day: "Pazar", focus: "Haftalık tekrar ve mini deneme", minutes }
          ],
          review_topics: focus.slice(0, 3).map((item) => item[1]),
          goethe: {
            exam_level: targetLevel,
            weeks: Array.from({ length: weekCount }, (_, index) => ({
              week: index + 1,
              focus: index === weekCount - 1 ? "Goethe denemesi ve eksik konuları tekrar" : `${skills[index % skills.length]}: ${focus[index % focus.length][1]} ağırlıklı pratik`,
              skills,
              practice: index === weekCount - 1 ? "Süre tutarak deneme çöz; yanlışlarını tekrar et." : `Günde ${minutes} dakika çalış; ${skills[index % skills.length]} için kısa alıştırma ve kelime tekrarı yap.`
            }))
          }
        }
      });
      console.error("Assessment continuing with score-based plan after AI failure", aiError);
    }
    scores.schreiben = intro.trim() ? ai.writing_score : null;
    const input = { goal, minutes, targetLevel, examWeeks, scores, intro, answered: ids.length, total: g.total, score: g.score };
    const a = supabaseAdmin();
    const { data: row, error } = await a.from("assessments").insert({ user_id: c.user.id, level, input, strengths: ai.strengths, weaknesses: ai.weaknesses, plan: ai.plan, summary: ai.summary }).select("id").single();
    if (error) throw error;
    await a.from("learning_plans").update({ active: false }).eq("user_id", c.user.id);
    await a.from("learning_plans").insert({ user_id: c.user.id, assessment_id: row.id, plan: ai.plan });
    await a.from("profiles").update({ cefr_level: level, learning_goal: goal, daily_minutes: minutes, target_level: targetLevel }).eq("id", c.user.id);
    const readiness = pct(g.score, g.total);
    return NextResponse.json({ assessment: { level, summary: ai.summary, strengths: ai.strengths, weaknesses: ai.weaknesses, plan: ai.plan, scores, readiness, details: g.results.map(r => ({ id: r.id, correct: r.correct, explanation: r.explanation })), aiFallback } });
  } catch (e) {
    console.error("Assessment AI or persistence failed", e);
    const message = e instanceof Error ? e.message : "";
    const timedOut = e instanceof Error && (e.name === "TimeoutError" || /timed? out|timeout/i.test(message));
    const overloaded = /Gemini 503/.test(message);
    const invalidKeyCharacters = /ByteString/.test(message);
    return NextResponse.json({
      error: timedOut
        ? "AI sağlayıcısı 60 saniye içinde yanıt vermedi. AI bağlantısını test et; hata sürerse API anahtarını sağlayıcı panelinden kontrol et."
        : overloaded
          ? "Gemini şu anda yoğun (503). Anahtarın kabul edildi; biraz sonra tekrar dene."
          : invalidKeyCharacters
            ? "API anahtarı geçersiz karakter içeriyor. Sağlayıcı panelinden anahtarı yeniden kopyala; başına/sonuna açıklama veya tırnak ekleme."
            : "AI servisi yanıt vermedi. API anahtarını ve sağlayıcı ayarını kontrol et."
    }, { status: 502 });
  }
}
