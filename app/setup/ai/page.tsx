import { requireUser } from "@/lib/auth";
import { getAIConfig } from "@/lib/ai";
import AISettingsForm from "@/components/AISettingsForm";

export default async function AISetup() {
  const { profile } = await requireUser();
  let configured = false;
  try { await getAIConfig(); configured = true; } catch { /* show setup */ }

  if (profile.role !== "admin") return <main className="wrap" style={{ maxWidth: 760, paddingTop: "8vh" }}>
    <div className="brand">Deutsch<b>AI</b></div><section className="panel">
      <h1>AI öğretmen bağlantısı bekleniyor</h1>
      <p className="muted">Derslere başlamadan önce yöneticinin Gemini veya OpenAI sağlayıcısını bağlayıp doğrulaması gerekiyor. Anahtarın güvenliği için kendi hesabından API ayarı yapamazsın.</p>
      {configured && <p className="ok">AI bağlantısı hazır. <a href="/assessment">Seviye tespit sınavına geç →</a></p>}
    </section></main>;

  return <main className="wrap" style={{ maxWidth: 820, paddingTop: "6vh" }}>
    <div className="brand">Deutsch<b>AI</b></div>
    <h1>Önce AI öğretmenini bağlayalım</h1>
    <p className="muted">API anahtarı yalnızca sunucuya şifrelenerek kaydedilir. Bağlantı testi başarılı olmadan seviye sınavına geçilmez.</p>
    <AISettingsForm continueTo="/assessment" />
  </main>;
}
