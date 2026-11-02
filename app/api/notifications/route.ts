import { NextResponse } from "next/server";
import { apiContext } from "@/lib/auth";
export async function POST() {
  const c = await apiContext();
  if (!c) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await c.sb.from("notifications").update({ read: true }).eq("user_id", c.user.id).eq("read", false);
  return NextResponse.json({ ok: true });
}
