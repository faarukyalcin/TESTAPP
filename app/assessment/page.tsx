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
  return <main className="wrap"><div className="brand">Deutsch<b>AI</b></div><h1>Seviye tespiti</h1>
    <p className="muted">A1/A2 seviyeni belirlemek için {qs.length} soru + kısa bir yazı. Puanlama sunucuda yapılır. Sonuç, kişisel planını oluşturur. Dinleme soruları tarayıcı sesiyle oynatılır. Konuşma bu testte ölçülmez; Sprechen bölümünde pratik yapabilirsin.</p>
    <AssessmentClient questions={qs} defaultMinutes={profile.daily_minutes} />
  </main>;
}
