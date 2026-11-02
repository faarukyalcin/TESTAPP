import { NextResponse } from "next/server";
import { z } from "zod";
import { apiContext } from "@/lib/auth";
import { checkAchievements } from "@/lib/game";

const schema = z.object({ kind: z.string().max(30), seconds: z.number().int().min(1).max(300) });
export async function POST(req: Request) {
  const c = await apiContext();
  if (!c) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Geçersiz veri" }, { status: 400 });
  const { error } = await c.sb.from("study_sessions").insert({ user_id: c.user.id, kind: p.data.kind, seconds: p.data.seconds });
  if (error) return NextResponse.json({ error: "Kaydedilemedi" }, { status: 500 });
  if (Math.random() < 0.1) await checkAchievements(c.user.id).catch(() => {});
  return NextResponse.json({ ok: true });
}
