import { notFound } from "next/navigation";
import Link from "next/link";
import { requireStudent } from "@/lib/auth";
import { loadBy } from "@/lib/server-data";
import { publicQ } from "@/lib/scoring";
import PracticeSet from "@/components/PracticeSet";

type Comparison = { wrong: string; right: string; why: string };

export default async function GrammarTopic({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { sb } = await requireStudent();
  const { data: topic } = await sb.from("grammar_topics").select("*").eq("id", id).maybeSingle();
  if (!topic) notFound();

  const questions = (await loadBy("grammar_id", id)).map(publicQ);
  const comparisons = Array.isArray(topic.comparisons) ? topic.comparisons as Comparison[] : [];
  const level = topic.level === "A2" ? "A2" : "A1";

  return <main className="wrap grammar-topic-page">
    <nav className="grammar-breadcrumb" aria-label="Sayfa yolu">
      <Link href="/grammar">Gramer merkezi</Link><span aria-hidden="true">/</span><span>{level}</span><span aria-hidden="true">/</span><span aria-current="page">{topic.title}</span>
    </nav>

    <header className="grammar-topic-hero">
      <div>
        <span className="eyebrow"><i className="eyebrow-dot" /> {level} GRAMER DERSİ</span>
        <h1>{topic.title}</h1>
        <p>{topic.explanation_tr}</p>
        <div className="grammar-topic-hero-meta"><span className="tag">{level} seviyesi</span><span>{questions.length} alıştırma</span><span>Yaklaşık {Math.max(2, Math.ceil(questions.length * 1.5))} dakika</span></div>
      </div>
      <a className="btn grammar-start-button" href="#grammar-practice">Alıştırmaya başla <span aria-hidden="true">↓</span></a>
    </header>

    <div className="grammar-topic-columns">
      <div className="grammar-topic-main">
        <section className="grammar-rule-card">
          <div className="grammar-card-heading"><span className="grammar-card-label">KURALI ANLA</span><span className="grammar-card-symbol" aria-hidden="true">§</span></div>
          <h2>{topic.title} nasıl kullanılır?</h2>
          <p>{topic.explanation_tr}</p>
        </section>

        {comparisons.length > 0 && <section className="grammar-examples-section">
          <div className="grammar-content-heading"><div><span className="eyebrow">ÖRNEKLERLE ÖĞREN</span><h2>Sık yapılan hatalar</h2></div><span className="grammar-example-count">{String(comparisons.length).padStart(2, "0")} örnek</span></div>
          <div className="grammar-comparison-list">{comparisons.map((comparison, index) =>
            <article className="grammar-comparison" key={index}>
              <div className="grammar-comparison-number">{String(index + 1).padStart(2, "0")}</div>
              <div className="grammar-comparison-content">
                <div className="grammar-sentence-pair"><div className="grammar-sentence-wrong"><span>SIK YAPILAN HATA</span><p>{comparison.wrong}</p></div><span className="grammar-comparison-arrow" aria-hidden="true">→</span><div className="grammar-sentence-right"><span>DOĞRU KULLANIM</span><p>{comparison.right}</p></div></div>
                <p className="grammar-comparison-why">{comparison.why}</p>
              </div>
            </article>
          )}</div>
        </section>}

        <section className="grammar-practice-section" id="grammar-practice">
          <div className="grammar-content-heading"><div><span className="eyebrow">ŞİMDİ SEN DENE</span><h2>Bilgini pekiştir</h2></div><span className="grammar-example-count">{questions.length} soru</span></div>
          {questions.length ? <PracticeSet questions={questions} variant="grammar" /> : <div className="grammar-empty panel"><div><h3>Alıştırmalar hazırlanıyor</h3><p className="muted">Bu konu için sorular yakında eklenecek.</p></div></div>}
        </section>
      </div>

      <aside className="grammar-topic-aside">
        <section className="grammar-study-card">
          <span className="grammar-aside-kicker">BU DERSTE</span>
          <h2>Üç adımda öğren</h2>
          <ol><li><span>1</span><div><b>Kuralı oku</b><small>Temel fikri kavra</small></div></li><li><span>2</span><div><b>Örnekleri incele</b><small>Doğru cümleyi tanı</small></div></li><li><span>3</span><div><b>Soruları çöz</b><small>Bilgini hemen dene</small></div></li></ol>
          <a className="text-link" href="#grammar-practice">Sorulara geç <span aria-hidden="true">→</span></a>
        </section>
        <section className="grammar-ai-card">
          <span className="grammar-ai-mark" aria-hidden="true">AI</span>
          <h2>Bir yerde mi takıldın?</h2>
          <p>Çözemediğin sorudaki “AI öğretmene sor” düğmesiyle kuralı Türkçe açıklat.</p>
          <Link href="/learn">AI öğretmeni aç <span aria-hidden="true">↗</span></Link>
        </section>
      </aside>
    </div>
  </main>;
}
