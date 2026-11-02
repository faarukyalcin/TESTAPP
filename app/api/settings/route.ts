import { NextResponse } from "next/server";
import { z } from "zod";
import { apiContext } from "@/lib/auth";

const schema = z.object({
  display_name: z.string().trim().min(1).max(60), learning_goal: z.string().trim().max(160),
  daily_minutes: z.number().int().min(5).max(240), target_level: z.enum(["A1", "A2"]),
  theme: z.enum(["light", "dark"]), voice_rate: z.number().min(0.5).max(1.2),
  notify_daily: z.boolean(), notify_weekly: z.boolean()
});
export async function POST(req: Request) {
  const c = await apiContext();
  if (!c) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Geçersiz değerler" }, { status: 400 });
  const { theme, voice_rate, notify_daily, notify_weekly, ...profile } = p.data;
  const e1 = (await c.sb.from("profiles").update(profile).eq("id", c.user.id)).error;
  const e2 = (await c.sb.from("user_settings").upsert({ user_id: c.user.id, theme, voice_rate, notify_daily, notify_weekly })).error;
  if (e1 || e2) return NextResponse.json({ error: "Ayarlar kaydedilemedi" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
