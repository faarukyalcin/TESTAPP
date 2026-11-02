import { NextResponse } from "next/server";
import { z } from "zod";
import { apiContext } from "@/lib/auth";
import { loadPool } from "@/lib/server-data";
import { publicQ } from "@/lib/scoring";
import { supabaseAdmin } from "@/lib/supabase/admin";

const schema = z.object({ level: z.enum(["A1", "A2"]), skill: z.enum(["all", "lesen", "horen", "grammatik", "wortschatz"]) });
const ORDER = ["lesen", "horen", "grammatik", "wortschatz"];
export async function POST(req: Request) {
  const c = await apiContext();
  if (!c) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Geçersiz veri" }, { status: 400 });
  const pool = (await loadPool()).filter(q => q.level === p.data.level && (p.data.skill === "all" || q.skill === p.data.skill))
    .sort((a, b) => ORDER.indexOf(a.skill) - ORDER.indexOf(b.skill) || a.id.localeCompare(b.id));
  if (!pool.length) return NextResponse.json({ error: "Bu seçim için soru yok." }, { status: 404 });
  const duration_s = Math.max(120, pool.length * 75);
  const { data, error } = await supabaseAdmin().from("exam_sessions").insert({ user_id: c.user.id, level: p.data.level, skill: p.data.skill, question_ids: pool.map(q => q.id), duration_s }).select("id,started_at").single();
  if (error) return NextResponse.json({ error: "Sınav başlatılamadı" }, { status: 500 });
  return NextResponse.json({ sessionId: data.id, startedAt: data.started_at, duration_s, questions: pool.map(publicQ) });
}
