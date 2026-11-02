import { requireStudent } from "@/lib/auth";
import Flashcards from "@/components/Flashcards";

export default async function Vocabulary() {
  const { sb, user, profile } = await requireStudent();
  const level = profile.cefr_level === "A2" ? "A2" : "A1";
  const [{ data: all }, { data: prog }] = await Promise.all([
    sb.from("vocabulary").select("*").order("id"), sb.from("vocabulary_progress").select("*").eq("user_id", user.id)
  ]);
  const p = new Map((prog || []).map((x: any) => [x.vocab_id, x]));
  const now = new Date().toISOString();
  const due = (all || []).filter((v: any) => p.get(v.id) && p.get(v.id).due_at <= now);
  const NEW_PER_DAY = 10;
  const fresh = (all || []).filter((v: any) => !p.has(v.id)).sort((a: any, b: any) => (a.level === level ? 0 : 1) - (b.level === level ? 0 : 1) || a.id - b.id).slice(0, NEW_PER_DAY);
  const queue = [...due, ...fresh].map((v: any) => ({ ...v, favorite: p.get(v.id)?.favorite ?? false }));
  const learned = (prog || []).filter((x: any) => x.learned).length;
  const favs = (all || []).filter((v: any) => p.get(v.id)?.favorite);
  const upcoming = (prog || []).filter((x: any) => x.due_at > now).sort((a: any, b: any) => a.due_at.localeCompare(b.due_at)).slice(0, 5);
  const byId = new Map((all || []).map((v: any) => [v.id, v]));
  return <main className="wrap"><h1>Kelime çalışması</h1>
    <p className="muted">{learned} kelime öğrenildi · {due.length} tekrar · {fresh.length} yeni kelime (günlük {NEW_PER_DAY} yeni kelime hedefi)</p>
    <Flashcards cards={queue} />
    {favs.length > 0 && <section className="panel"><h2>⭐ Favoriler</h2>{favs.map((v: any) => <span key={v.id} className="tag">{v.article ? `${v.article} ` : ""}{v.de} = {v.tr}</span>)}</section>}
    {upcoming.length > 0 && <section className="panel"><h2>Tekrar takvimin</h2><table><tbody>{upcoming.map((u: any) => <tr key={u.vocab_id}><td>{(byId.get(u.vocab_id) as any)?.de}</td><td className="muted">{new Date(u.due_at).toLocaleDateString("tr-TR")}</td></tr>)}</tbody></table></section>}
  </main>;
}
