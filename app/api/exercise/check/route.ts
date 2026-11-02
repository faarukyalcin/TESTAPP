import { NextResponse } from "next/server";
import { z } from "zod";
import { apiContext } from "@/lib/auth";
import { loadByIds } from "@/lib/server-data";
import { supabaseAdmin } from "@/lib/supabase/admin";

const schema = z.object({ id: z.string().max(80), answer: z.string().max(300) });
export async function POST(req: Request) {
  const c = await apiContext();
  if (!c) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Geçersiz veri" }, { status: 400 });
  const [q] = await loadByIds([p.data.id]);
  if (!q) return NextResponse.json({ error: "Soru bulunamadı" }, { status: 404 });
  const correct = p.data.answer === q.answer;
  await supabaseAdmin().from("exercise_attempts").insert({ user_id: c.user.id, exercise_id: q.id, answer: p.data.answer, correct });
  return NextResponse.json({ correct, answer: q.answer, explanation: q.explanation });
}
