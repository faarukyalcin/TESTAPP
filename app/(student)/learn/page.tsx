import { requireStudent } from "@/lib/auth";
import ChatClient from "@/components/ChatClient";
export default async function Learn() {
  const { sb, user } = await requireStudent();
  const { data } = await sb.from("chat_messages").select("role,content").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30);
  return <main className="wrap"><h1>AI Almanca öğretmenin</h1><p className="muted">Almanca veya Türkçe yaz. Hatalarını düzeltir, kuralı Türkçe açıklar. Önceki konuşmaları ve zayıf yönlerini hatırlar.</p>
    <ChatClient initial={(data || []).reverse() as { role: "user" | "assistant"; content: string }[]} /></main>;
}
