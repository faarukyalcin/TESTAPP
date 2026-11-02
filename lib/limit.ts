import { supabaseAdmin } from "@/lib/supabase/admin";
/** Kullanıcı başına AI kullanım sınırı + kullanım kaydı. true = izin verildi. */
export async function aiAllowed(userId: string, kind: string, max: number, windowMin = 60) {
  const a = supabaseAdmin();
  const since = new Date(Date.now() - windowMin * 60_000).toISOString();
  const { count } = await a.from("ai_usage").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("kind", kind).gte("created_at", since);
  if ((count ?? 0) >= max) return false;
  await a.from("ai_usage").insert({ user_id: userId, kind });
  return true;
}
