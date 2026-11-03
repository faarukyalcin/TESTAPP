import { requireStudent } from "@/lib/auth";
import AILesson from "@/components/AILesson";
export default async function Lessons() {
  await requireStudent();
  return <main className="wrap"><h1>AI ile Almanca derslerin</h1><p className="muted">Her ders Gemini tarafından seviyene ve önceki yanıtlarına göre hazırlanır. Bir konu seç; öğretmenin dersi, alıştırmaları ve kişisel geri bildirimi oluştursun.</p><AILesson /></main>;
}
