import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { loadPool } from "@/lib/server-data";
import { pickAssessment, publicQ } from "@/lib/scoring";
import AssessmentClient from "@/components/AssessmentClient";
import { getAIConfig } from "@/lib/ai";
import { redirect } from "next/navigation";

export default async function Assessment() {
  const { profile, user, sb } = await requireUser();
  try { await getAIConfig(user.id, sb); } catch { redirect("/setup/ai"); }
  const qs = pickAssessment(await loadPool()).map(publicQ);
  return <main className="wrap onboarding-wrap">
    <header className="onboarding-topbar">
      <Link href="/assessment" className="brand onboarding-brand">Deutsch<b>AI</b></Link>
      <span className="onboarding-status"><i /> KİŞİSEL PROGRAMIN HAZIRLANIYOR</span>
      <Link className="onboarding-settings" href="/setup/ai">AI ayarları</Link>
    </header>
    <section className="onboarding-hero">
      <span className="eyebrow">ADIM 02 <span className="step-divider">/</span> SEVİYE TESPİTİ</span>
      <h1>Almanca seviyeni tanıyalım.</h1>
      <p>Yanıtlarına göre sana uygun A1 veya A2 seviyesini belirleyip Goethe hedefin için kişisel bir çalışma programı hazırlayacağız.</p>
      <div className="onboarding-facts">
        <span><b>{qs.length}</b> kısa soru</span><span><b>1</b> kendini tanıtma yazısı</span><span><b>A1–A2</b> değerlendirme</span>
      </div>
    </section>
    <AssessmentClient questions={qs} defaultMinutes={profile.daily_minutes} />
    <footer className="onboarding-footer">DeutschAI <span>·</span> Goethe hedefin için kişisel Almanca öğrenme programı</footer>
  </main>;
}
