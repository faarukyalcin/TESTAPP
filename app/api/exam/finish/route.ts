import { NextResponse } from "next/server";
import { z } from "zod";
import { apiContext } from "@/lib/auth";
import { loadByIds } from "@/lib/server-data";
import { gradeAnswers } from "@/lib/scoring";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { award } from "@/lib/game";

const schema = z.object({ sessionId: z.string().uuid(), answers: z.record(z.string(), z.string().max(300)) });
export async function POST(req: Request) {
  const c = await apiContext();
  if (!c) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Geçersiz veri" }, { status: 400 });
  const a = supabaseAdmin();
  const { data: s } = await a.from("exam_sessions").select("*").eq("id", p.data.sessionId).eq("user_id", c.user.id).maybeSingle();
  if (!s) return NextResponse.json({ error: "Sınav bulunamadı" }, { status: 404 });
  if (s.status !== "running") return NextResponse.json({ error: "Sınav zaten bitirilmiş." }, { status: 409 });
  const qs = await loadByIds(s.question_ids as string[]);
  const g = gradeAnswers(qs, p.data.answers); // sınav dışı soru kimlikleri yok sayılır
  const elapsed = (Date.now() - new Date(s.started_at).getTime()) / 1000;
  await a.from("exam_sessions").update({ status: elapsed > s.duration_s + 90 ? "late" : "finished", finished_at: new Date().toISOString() }).eq("id", s.id);
  await a.from("exam_answers").insert(g.results.map(r => ({ session_id: s.id, user_id: c.user.id, exercise_id: r.id, answer: r.given, correct: r.correct })));
  await a.from("exam_results").insert({ session_id: s.id, user_id: c.user.id, score: g.score, total: g.total, pct: g.pct, by_skill: g.bySkill });
  await a.from("exercise_attempts").insert(g.results.map(r => ({ user_id: c.user.id, exercise_id: r.id, answer: r.given, correct: r.correct })));
  await award(c.user.id, 10 + Math.round(g.pct / 5));
  return NextResponse.json({ sessionId: s.id });
}
