"use client";
import { useEffect, useState } from "react";

type Settings = { provider: "gemini" | "openai"; model: string; keyConfigured: boolean; keySource: "dashboard" | "vercel" | "missing"; encryptionReady?: boolean; updatedAt: string | null };
const MODELS = { gemini: "gemini-3.8-flash", openai: "gpt-4.1-mini" };
async function responseJson(r: Response) {
  return r.json().catch(() => ({ error: `Sunucu geçerli JSON döndürmedi (HTTP ${r.status}). Vercel API ayarlarını kontrol et.` }));
}

export default function AISettingsForm({ continueTo, endpoint = "/api/admin/ai-settings" }: { continueTo?: string; endpoint?: string }) {
  const [provider, setProvider] = useState<"gemini" | "openai">("gemini");
  const [model, setModel] = useState(MODELS.gemini);
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [testing, setTesting] = useState(false);
  const [verified, setVerified] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(endpoint).then(async r => {
      const d = await responseJson(r); if (!r.ok) throw new Error(d.error || "Ayarlar alınamadı.");
      setStatus(d); setProvider(d.provider); setModel(d.model); setSaved(true);
    }).catch(e => setError(e instanceof Error ? e.message : "Ayarlar alınamadı."));
  }, [endpoint]);

  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const r = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider, model, apiKey }) });
      const d = await responseJson(r); if (!r.ok) throw new Error(d.error || "Kaydedilemedi.");
      setApiKey(""); setMessage("AI sağlayıcı ayarları kaydedildi.");
      setVerified(false); setSaved(true);
      setStatus({ provider, model, keyConfigured: d.keyConfigured, keySource: "dashboard", updatedAt: new Date().toISOString() });
      setTesting(true);
      setMessage("Ayar kaydedildi, bağlantı test ediliyor…");
      const test = await fetch(`${endpoint}/test`, { method: "POST" });
      const result = await responseJson(test);
      if (!test.ok) throw new Error(result.error || "AI bağlantısı test edilemedi.");
      setVerified(true);
      setMessage(`Bağlantı başarılı · ${result.latencyMs} ms · ${result.reply}`);
    } catch (e) { setError(e instanceof Error ? e.message : "Kaydedilemedi."); }
    finally { setBusy(false); setTesting(false); }
  }

  async function testConnection() {
    setTesting(true); setError(""); setMessage("");
    try {
      const r = await fetch(`${endpoint}/test`, { method: "POST" });
      const d = await responseJson(r);
      if (!r.ok) throw new Error(d.error || "AI bağlantısı test edilemedi.");
      setVerified(true);
      setMessage(`Bağlantı başarılı · ${d.latencyMs} ms · ${d.reply}`);
    } catch (e) { setError(e instanceof Error ? e.message : "AI bağlantısı test edilemedi."); }
    finally { setTesting(false); }
  }

  return <form className="panel" onSubmit={save} style={{ maxWidth: 720 }}>
    <div className="field"><label>AI sağlayıcısı</label><select value={provider} onChange={e => { const v = e.target.value as "gemini" | "openai"; setProvider(v); setModel(MODELS[v]); setApiKey(""); setVerified(false); setSaved(false); }}><option value="gemini">Google Gemini</option><option value="openai">OpenAI ChatGPT</option></select></div>
    <div className="field"><label>Model adı</label><input value={model} onChange={e => { setModel(e.target.value); setVerified(false); setSaved(false); }} maxLength={100} required /></div>
    <div className="field"><label>{provider === "gemini" ? "Gemini API anahtarı" : "OpenAI API anahtarı"}</label><input type="password" value={apiKey} onChange={e => { setApiKey(e.target.value); if (e.target.value) { setVerified(false); setSaved(false); } }} autoComplete="new-password" placeholder={status?.keyConfigured ? "Kayıtlı anahtarı değiştirmek için yenisini gir" : "API anahtarını buraya yapıştır"} maxLength={500} /></div>
    <p className="muted">Güvenlik: Kayıtlı anahtar tekrar gösterilmez. Şifrelenmiş olarak veritabanında saklanır; şifreleme anahtarı yalnızca Vercel sunucu ortam değişkeninde bulunur.</p>
    {status && <p className="muted">Durum: {status.keyConfigured ? `API anahtarı hazır (${status.keySource === "dashboard" ? "panelden kaydedildi" : "Vercel ortam değişkeninden geliyor"})` : status.keySource === "dashboard" && status.encryptionReady === false ? "Kayıtlı anahtar var ancak APP_ENCRYPTION_KEY eksik veya geçersiz." : "API anahtarı henüz tanımlanmadı."}</p>}
    {error && <p className="error">{error}</p>}{message && <p className="ok">{message}</p>}
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      <button className="btn" disabled={busy || model.trim().length < 2}>{busy ? "Kaydediliyor…" : "Ayarları kaydet"}</button>
      <button className="btn ghost" type="button" onClick={testConnection} disabled={testing || !saved || !status?.keyConfigured}>{testing ? "Bağlantı test ediliyor…" : "Gerçek AI bağlantısını test et"}</button>
      {continueTo && saved && status?.keyConfigured && <a className="btn" href={continueTo}>{verified ? "Bağlantı doğrulandı · seviye sınavına geç →" : "Seviye tespitine geç → (AI testini tekrar deneyebilirsin)"}</a>}
    </div>
  </form>;
}

