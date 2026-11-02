import { requireStudent } from "@/lib/auth";
import MarkRead from "@/components/MarkRead";
export default async function Notifications() {
  const { sb, user } = await requireStudent();
  const { data } = await sb.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50);
  const unread = (data || []).filter((n: any) => !n.read).length;
  return <main className="wrap"><h1>Bildirimler</h1>{unread > 0 && <MarkRead />}
    {(data || []).length ? (data || []).map((n: any) => <section key={n.id} className="panel" style={{ opacity: n.read ? .65 : 1 }}><b>{n.title}</b>{n.kind === "task" && <span className="tag">Görev</span>}<p className="muted">{n.body}</p><span className="muted">{new Date(n.created_at).toLocaleString("tr-TR")}</span></section>) : <p className="muted">Bildirim yok.</p>}
  </main>;
}
