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
    <p className="muted">Gemini veya OpenAI hesabından aldığın API anahtarını ekle. Anahtarın hesabına özel, şifrelenmiş olarak saklanır. Bağlantı testinden sonra seviye sınavına geçebilirsin.</p>
    <AISettingsForm endpoint="/api/user-ai-settings" continueTo="/assessment" />
    {configured && <p className="ok">Kişisel AI bağlantın hazır. <a href="/assessment">Seviye tespit sınavına geç →</a></p>}
  </main>;
}

