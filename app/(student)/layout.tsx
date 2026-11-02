import { requireStudent } from "@/lib/auth";
import Nav from "@/components/Nav";
import StudyTimer from "@/components/StudyTimer";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const { sb, user, profile } = await requireStudent();
  const [{ data: st }, { count }] = await Promise.all([
    sb.from("user_settings").select("theme").eq("user_id", user.id).maybeSingle(),
    sb.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("read", false)
  ]);
  return <div className="shell" data-theme={st?.theme === "light" ? "light" : "dark"}>
    <Nav unread={count ?? 0} admin={profile.role === "admin"} />
    <StudyTimer />
    {children}
  </div>;
}
