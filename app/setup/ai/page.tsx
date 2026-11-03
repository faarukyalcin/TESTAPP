import { requireUser } from "@/lib/auth";
import { getAIConfig } from "@/lib/ai";
import AISettingsForm from "@/components/AISettingsForm";

export default async function AISetup() {
  const { user, sb } = await requireUser();
  let configured = false;
  try { await getAIConfig(user.id, sb); configured = true; } catch { /* show setup */ }

  return <main className="wrap" style={{ maxWidth: 820, paddingTop: "6vh" }}>
    <div className="brand">Deutsch<b>AI</b></div>
    <h1>Kendi AI öğretmenini bağla</h1>
    <p className="muted">OpenAI ChatGPT ve Google Gemini anahtarlarını ayrı ayrı ekleyebilirsin. Jarvis’in sistemi hangi sağlayıcıyla yöneteceğini AI öğretmen sayfasından seçersin. Anahtarlar hesabına özel, şifrelenmiş olarak saklanır.</p>
    <AISettingsForm endpoint="/api/user-ai-settings" continueTo="/assessment" />
    {configured && <p className="ok">Kişisel AI bağlantın hazır. <a href="/assessment">Seviye tespit sınavına geç →</a></p>}
  </main>;
}

