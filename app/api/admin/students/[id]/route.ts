import { NextResponse } from "next/server";
import { z } from "zod";
import { apiAdminContext } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

const idSchema = z.string().uuid();
const patch = z.object({ active: z.boolean().optional(), admin_goal: z.string().max(300).nullable().optional() });
const task = z.object({ title: z.string().trim().min(2).max(120), body: z.string().trim().max(500).default("") });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = await apiAdminContext();
  if (!c) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = idSchema.safeParse((await params).id);
  const p = patch.safeParse(await req.json().catch(() => null));
  if (!id.success || !p.success) return NextResponse.json({ error: "Geçersiz veri" }, { status: 400 });
  if (id.data === c.user.id && p.data.active === false) return NextResponse.json({ error: "Kendi hesabını devre dışı bırakamazsın." }, { status: 400 });
  const a = supabaseAdmin();
  if (p.data.active !== undefined) {
    const { error } = await a.auth.admin.updateUserById(id.data, { ban_duration: p.data.active ? "none" : "876000h" });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }
  const { error } = await a.from("profiles").update(p.data).eq("id", id.data);
  if (error) return NextResponse.json({ error: "Güncellenemedi" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// Öğrenciye görev/bildirim gönder
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = await apiAdminContext();
  if (!c) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = idSchema.safeParse((await params).id);
  const p = task.safeParse(await req.json().catch(() => null));
  if (!id.success || !p.success) return NextResponse.json({ error: "Geçersiz veri" }, { status: 400 });
  const { error } = await supabaseAdmin().from("notifications").insert({ user_id: id.data, title: p.data.title, body: p.data.body, kind: "task" });
  if (error) return NextResponse.json({ error: "Gönderilemedi" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
