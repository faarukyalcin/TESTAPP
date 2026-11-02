import { NextResponse } from "next/server";
import { z } from "zod";
import { apiContext } from "@/lib/auth";
import { review, type Grade } from "@/lib/srs";
import { award } from "@/lib/game";

const schema = z.object({ id: z.number().int(), grade: z.number().int().min(0).max(3).optional(), favorite: z.boolean().optional(), learned: z.boolean().optional() });
export async function POST(req: Request) {
  const c = await apiContext();
  if (!c) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Geçersiz veri" }, { status: 400 });
  const { id, grade, favorite, learned } = p.data;
  const { data: cur } = await c.sb.from("vocabulary_progress").select("*").eq("user_id", c.user.id).eq("vocab_id", id).maybeSingle();
  const base = cur || { ease: 2.5, interval_days: 0, reps: 0, lapses: 0, favorite: false, learned: false };
  let patch: Record<string, unknown> = {};
  if (grade !== undefined) patch = { ...review(base, grade as Grade), last_reviewed: new Date().toISOString() };
  if (favorite !== undefined) patch.favorite = favorite;
  if (learned !== undefined) patch.learned = learned;
  const { error } = await c.sb.from("vocabulary_progress").upsert({ user_id: c.user.id, vocab_id: id, ...base, ...patch });
  if (error) return NextResponse.json({ error: "Kaydedilemedi" }, { status: 500 });
  if (grade !== undefined && grade >= 2) await award(c.user.id, 1).catch(() => {});
  return NextResponse.json({ ok: true, ...patch });
}
