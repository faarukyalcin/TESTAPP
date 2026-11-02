import { requireAdmin } from "@/lib/auth";
import AISettingsForm from "@/components/AISettingsForm";
import Link from "next/link";

export default async function AdminAISettings() {
  await requireAdmin();
  return <main className="wrap">
    <p><Link href="/admin">← Yönetim paneli</Link></p>
    <h1>AI sağlayıcı ayarları</h1>
    <p className="muted">Gemini veya OpenAI anahtarını yalnızca yönetici hesabından kaydet. Anahtar şifrelenerek sunucu tarafında tutulur ve öğrenci tarayıcısına gönderilmez.</p>
    <AISettingsForm />
  </main>;
}
