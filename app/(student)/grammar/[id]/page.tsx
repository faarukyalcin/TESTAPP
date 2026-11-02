import { notFound } from "next/navigation";
import Link from "next/link";
import { requireStudent } from "@/lib/auth";
import { loadBy } from "@/lib/server-data";
import { publicQ } from "@/lib/scoring";
import PracticeSet from "@/components/PracticeSet";
export default async function GrammarTopic({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { sb } = await requireStudent();
  const { data: g } = await sb.from("grammar_topics").select("*").eq("id", id).maybeSingle();
  if (!g) notFound();
  const qs = await loadBy("grammar_id", id);
  return <main className="wrap"><Link href="/grammar">← Gramer</Link><h1>{g.title}</h1><span className="tag">{g.level}</span>
    <section className="panel"><p style={{ lineHeight: 1.7 }}>{g.explanation_tr}</p></section>
    <section className="panel"><h2>Yanlış ↔ Doğru</h2>{(g.comparisons as { wrong: string; right: string; why: string }[]).map((c, i) => <p key={i}><span className="error">✗ {c.wrong}</span><br /><span className="ok">✓ {c.right}</span><br /><span className="muted">{c.why}</span></p>)}</section>
    <h2>Alıştırmalar</h2><PracticeSet questions={qs.map(publicQ)} />
    <section className="panel"><h3>AI ile açıklat</h3><p className="muted">Anlamadığın bir noktayı AI öğretmene sor.</p><Link className="btn small" href="/learn">AI öğretmene git →</Link></section>
  </main>;
}
