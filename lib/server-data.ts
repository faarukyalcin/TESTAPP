import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Q } from "@/lib/scoring";

export async function loadPool(): Promise<Q[]> {
  const { data } = await supabaseAdmin().from("exercises").select("*").is("lesson_id", null).is("grammar_id", null);
  return (data || []) as Q[];
}
export async function loadByIds(ids: string[]): Promise<Q[]> {
  if (!ids.length) return [];
  const { data } = await supabaseAdmin().from("exercises").select("*").in("id", ids);
  return (data || []) as Q[];
}
export async function loadBy(col: "lesson_id" | "grammar_id", id: string): Promise<Q[]> {
  const { data } = await supabaseAdmin().from("exercises").select("*").eq(col, id).order("id");
  return (data || []) as Q[];
}
