"use client";
import { useEffect, useState } from "react";

type Settings = { provider: "gemini" | "openai"; model: string; keyConfigured: boolean; keySource: "dashboard" | "vercel" | "missing"; encryptionReady?: boolean; updatedAt: string | null };
const MODELS = { gemini: "gemini-2.5-flash", openai: "gpt-4.1-mini" };

export default function AISettingsForm() {
  const [provider, setProvider] = useState<"gemini" | "openai">("gemini");
  const [model, setModel] = useState(MODELS.gemini);
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    fetch("/api/admin/ai-settings").then(async r => {
      const d = await r.json(); if (!r.ok) throw new Error(d.error || "Ayarlar alınamadı.");
      setStatus(d); setProvider(d.provider); setModel(d.model);
    }).catch(e => setError(e instanceof Error ? e.message : "Ayarlar alınamadı."));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const r = await fetch("/api/admin/ai-settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider, model, apiKey }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || "Kaydedilemedi.");
      setApiKey(""); setMessage("AI sağlayıcı ayarları kaydedildi.");
      setStatus({ provider, model, keyConfigured: d.keyConfigured, keySource: "dashboard", updatedAt: new Date().toISOString() });
    } catch (e) { setError(e instanceof Error ? e.message : "Kaydedilemedi."); }
    finally { setBusy(false); }
  }

  async function testConnection() {
    setTesting(true); setError(""); setMessage("");
    try {
      const r = await fetch("/api/admin/ai-settings/test", { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "AI bağlantısı test edilemedi.");
      setMessage(`Bağlantı başarılı · ${d.latencyMs} ms · ${d.reply}`);
    } catch (e) { setError(e instanceof Error ? e.message : "AI bağlantısı test edilemedi."); }
    finally { setTesting(false); }
  }

  return <form className="panel" onSubmit={save} style={{ maxWidth: 720 }}>
    <div className="field"><label>AI sağlayıcısı</label><select value={provider} onChange={e => { const v = e.target.value as "gemini" | "openai"; setProvider(v); setModel(MODELS[v]); setApiKey(""); }}><option value="gemini">Google Gemini</option><option value="openai">OpenAI</option></select></div>
    <div className="field"><label>Model adı</label><input value={model} onChange={e => setModel(e.target.value)} maxLength={100} required /></div>
    <div className="field"><label>{provider === "gemini" ? "Gemini API anahtarı" : "OpenAI API anahtarı"}</label><input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} autoComplete="new-password" placeholder={status?.keyConfigured ? "Kayıtlı anahtarı değiştirmek için yenisini gir" : "API anahtarını buraya yapıştır"} maxLength={500} /></div>
    <p className="muted">Güvenlik: Kayıtlı anahtar tekrar gösterilmez. Şifrelenmiş olarak veritabanında saklanır; şifreleme anahtarı yalnızca Vercel sunucu ortam değişkeninde bulunur.</p>
    {status && <p className="muted">Durum: {status.keyConfigured ? `API anahtarı hazır (${status.keySource === "dashboard" ? "panelden kaydedildi" : "Vercel ortam değişkeninden geliyor"})` : status.keySource === "dashboard" && status.encryptionReady === false ? "Kayıtlı anahtar var ancak APP_ENCRYPTION_KEY eksik veya geçersiz." : "API anahtarı henüz tanımlanmadı."}</p>}
    {error && <p className="error">{error}</p>}{message && <p className="ok">{message}</p>}
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      <button className="btn" disabled={busy || model.trim().length < 2}>{busy ? "Kaydediliyor…" : "Ayarları kaydet"}</button>
      <button className="btn ghost" type="button" onClick={testConnection} disabled={testing || !status?.keyConfigured}>{testing ? "Bağlantı test ediliyor…" : "Gerçek AI bağlantısını test et"}</button>
    </div>
  </form>;
}
