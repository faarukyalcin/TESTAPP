import Link from "next/link";
import { requireStudent } from "@/lib/auth";

function shortText(value: string | null | undefined) {
  const text = (value || "Almanca dil bilgisini örnekler ve kısa alıştırmalarla pekiştir.").replace(/\s+/g, " ").trim();
  return text.length > 132 ? `${text.slice(0, 129).trimEnd()}…` : text;
}

function TopicIcon({ level }: { level: string }) {
  return <span className={`grammar-topic-symbol ${level === "A2" ? "advanced" : "starter"}`} aria-hidden="true">
    {level === "A1" ? "01" : "02"}
  </span>;
}

export default async function Grammar() {
  const { sb } = await requireStudent();
  const { data: topics } = await sb.from("grammar_topics")
    .select("id,level,title,explanation_tr,position")
    .order("position");
  const allTopics = topics || [];
  const a1 = allTopics.filter((topic: { level: string }) => topic.level === "A1");
  const a2 = allTopics.filter((topic: { level: string }) => topic.level === "A2");

  return <main className="wrap grammar-page">
    <section className="grammar-hero">
      <div className="grammar-hero-copy">
        <span className="eyebrow"><i className="eyebrow-dot" /> GRAMER MERKEZİ</span>
        <h1>Almanca cümleleri<br /><span>doğru kur.</span></h1>
        <p>Kuralları kısa anlatımlarla öğren, doğru ve yanlış örnekleri karşılaştır, hemen ardından sorularla pekiştir.</p>
        <div className="grammar-hero-meta">
          <span><b>{allTopics.length}</b> konu başlığı</span>
          <i aria-hidden="true" />
          <span><b>2</b> öğrenme seviyesi</span>
        </div>
        <nav className="grammar-level-links" aria-label="Gramer seviyeleri">
          <a href="#a1-topics">A1 Temel <span aria-hidden="true">↓</span></a>
          <a href="#a2-topics">A2 Gelişim <span aria-hidden="true">↓</span></a>
        </nav>
      </div>
      <div className="grammar-hero-visual" aria-label="Almanca cümle yapısı örneği">
        <div className="grammar-visual-top"><span>CÜMLE YAPISI</span><span>A1 · 01</span></div>
        <div className="grammar-sentence">
          <span><b>Ich</b><small>özne</small></span>
          <span><b>lerne</b><small>fiil</small></span>
          <span><b>Deutsch.</b><small>tamamlayıcı</small></span>
        </div>
        <div className="grammar-visual-rule"><span>01</span><p>Almanca ana cümlede çekimli fiil<br />genellikle ikinci sırada yer alır.</p></div>
        <div className="grammar-visual-footer"><span>Doğru sırayla öğren</span><span aria-hidden="true">↗</span></div>
      </div>
    </section>

    {allTopics.length === 0 ? <section className="grammar-empty panel">
      <span className="grammar-empty-icon" aria-hidden="true">G</span>
      <div><h2>Konular hazırlanıyor</h2><p className="muted">Gramer başlıkları eklendiğinde burada görünecek.</p></div>
    </section> : <div className="grammar-levels">
      <section className="grammar-level-section" id="a1-topics">
        <header className="grammar-section-heading">
          <div className="grammar-section-title"><span className="grammar-level-badge">A1</span><div><p className="eyebrow">TEMEL SEVİYE</p><h2>Günlük Almancanın temeli</h2></div></div>
          <span className="grammar-topic-count">{a1.length} konu</span>
        </header>
        {a1.length ? <div className="grammar-topic-grid">{a1.map((topic: { id: string; title: string; level: string; explanation_tr?: string | null }, index: number) =>
          <Link className="grammar-topic-card" href={`/grammar/${topic.id}`} key={topic.id}>
            <div className="grammar-topic-card-top"><TopicIcon level={topic.level} /><span className="grammar-topic-index">KONU {String(index + 1).padStart(2, "0")}</span><span className="grammar-topic-arrow" aria-hidden="true">↗</span></div>
            <h3>{topic.title}</h3>
            <p>{shortText(topic.explanation_tr)}</p>
            <span className="grammar-topic-link">Konuyu incele <span aria-hidden="true">→</span></span>
          </Link>
        )}</div> : <p className="grammar-no-topics">A1 konuları yakında burada.</p>}
      </section>

      <section className="grammar-level-section" id="a2-topics">
        <header className="grammar-section-heading">
          <div className="grammar-section-title"><span className="grammar-level-badge a2">A2</span><div><p className="eyebrow">GELİŞİM SEVİYESİ</p><h2>Daha zengin cümleler kur</h2></div></div>
          <span className="grammar-topic-count">{a2.length} konu</span>
        </header>
        {a2.length ? <div className="grammar-topic-grid">{a2.map((topic: { id: string; title: string; level: string; explanation_tr?: string | null }, index: number) =>
          <Link className="grammar-topic-card" href={`/grammar/${topic.id}`} key={topic.id}>
            <div className="grammar-topic-card-top"><TopicIcon level={topic.level} /><span className="grammar-topic-index">KONU {String(index + 1).padStart(2, "0")}</span><span className="grammar-topic-arrow" aria-hidden="true">↗</span></div>
            <h3>{topic.title}</h3>
            <p>{shortText(topic.explanation_tr)}</p>
            <span className="grammar-topic-link">Konuyu incele <span aria-hidden="true">→</span></span>
          </Link>
        )}</div> : <p className="grammar-no-topics">A2 konuları yakında burada.</p>}
      </section>
    </div>}

    <footer className="grammar-footer-note"><span aria-hidden="true">✳</span><p>Her konuyu önce anla, sonra örnek cümlelerle kullan. Takıldığın soruyu tek dokunuşla AI öğretmene sorabilirsin.</p><Link href="/learn">AI öğretmene git <span aria-hidden="true">→</span></Link></footer>
  </main>;
}
