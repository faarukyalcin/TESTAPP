import { NextResponse } from "next/server";
import { z } from "zod";
import { apiContext } from "@/lib/auth";
import { loadBy } from "@/lib/server-data";
import { gradeAnswers } from "@/lib/scoring";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { award } from "@/lib/game";

const schema = z.object({ lessonId: z.string().max(60), answers: z.record(z.string(), z.string().max(300)) });
export async function POST(req: Request) {
  const c = await apiContext();
  if (!c) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Geçersiz veri" }, { status: 400 });
  const qs = await loadBy("lesson_id", p.data.lessonId);
  if (!qs.length) return NextResponse.json({ error: "Ders bulunamadı" }, { status: 404 });
  const g = gradeAnswers(qs, p.data.answers);
  const a = supabaseAdmin();
  const { data: prev } = await a.from("lesson_progress").select("score").eq("user_id", c.user.id).eq("lesson_id", p.data.lessonId).maybeSingle();
  await a.from("lesson_progress").upsert({ user_id: c.user.id, lesson_id: p.data.lessonId, score: Math.max(prev?.score ?? 0, g.pct), completed_at: new Date().toISOString() });
  await a.from("exercise_attempts").insert(g.results.map(r => ({ user_id: c.user.id, exercise_id: r.id, answer: r.given, correct: r.correct })));
  await award(c.user.id, prev ? 5 : 20 + Math.round(g.pct / 10));
  return NextResponse.json({ pct: g.pct, score: g.score, total: g.total, results: g.results });
}
