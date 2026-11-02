import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export type Profile = {
  id: string; display_name: string | null; role: "admin" | "student"; cefr_level: string | null;
  learning_goal: string | null; daily_minutes: number; active: boolean; target_level: string;
  admin_goal: string | null; xp: number;
};
const COLS = "id,display_name,role,cefr_level,learning_goal,daily_minutes,active,target_level,admin_goal,xp";

export async function getContext() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data } = await sb.from("profiles").select(COLS).eq("id", user.id).maybeSingle();
  return { sb, user, profile: (data as Profile | null) };
}

/** Giriş yapmış, aktif kullanıcı (seviye testi zorunluluğu olmadan). */
export async function requireUser() {
  const c = await getContext();
  if (!c) redirect("/login");
  if (!c.profile || !c.profile.active) redirect("/disabled");
  return { ...c, profile: c.profile };
}

/** Öğrenci sayfaları: seviye tespiti tamamlanmadan geçilemez (adminler muaf). */
export async function requireStudent() {
  const c = await requireUser();
  if (c.profile.role !== "admin") {
    const { count } = await c.sb.from("assessments").select("id", { count: "exact", head: true }).eq("user_id", c.user.id);
    if (!count) redirect("/assessment");
  }
  return c;
}

/** API için: oturum + aktif hesap. Yoksa null. */
export async function apiContext() {
  const c = await getContext();
  if (!c || !c.profile || !c.profile.active) return null;
  return { ...c, profile: c.profile };
}
export async function apiAdminContext() {
  const c = await apiContext();
  return c && c.profile.role === "admin" ? c : null;
}

/** Yönetici sayfaları için sunucu tarafı yetki kontrolü. */
export async function requireAdmin() {
  const c = await requireUser();
  if (c.profile.role !== "admin") redirect("/");
  return c;
}
