import Link from "next/link";
import { requireStudent } from "@/lib/auth";
export default async function Grammar() {
  const { sb } = await requireStudent();
  const { data } = await sb.from("grammar_topics").select("id,level,title").order("position");
  return <main className="wrap"><h1>Dil bilgisi merkezi</h1>
    {["A1", "A2"].map(lv => <section className="panel" key={lv}><h2>{lv}</h2>{(data || []).filter((g: any) => g.level === lv).map((g: any) => <p key={g.id}><Link href={`/grammar/${g.id}`}>{g.title}</Link></p>)}</section>)}
  </main>;
}
