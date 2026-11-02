import { requireStudent } from "@/lib/auth";
import ProfileForm from "@/components/ProfileForm";
export default async function Profile() {
  const { sb, user, profile } = await requireStudent();
  const { data: st } = await sb.from("user_settings").select("*").eq("user_id", user.id).maybeSingle();
  return <main className="wrap"><h1>Profil ve ayarlar</h1>
    <section className="panel"><p><b>E-posta:</b> {user.email}</p><p><b>Rol:</b> {profile.role === "admin" ? "Yönetici" : "Öğrenci"} · <b>Seviye:</b> {profile.cefr_level || "–"} · <b>XP:</b> {profile.xp}</p></section>
    <ProfileForm initial={{ display_name: profile.display_name || "", learning_goal: profile.learning_goal || "", daily_minutes: profile.daily_minutes, target_level: profile.target_level === "A1" ? "A1" : "A2", theme: st?.theme === "light" ? "light" : "dark", voice_rate: st?.voice_rate ?? 0.9, notify_daily: st?.notify_daily ?? true, notify_weekly: st?.notify_weekly ?? true }} />
  </main>;
}
