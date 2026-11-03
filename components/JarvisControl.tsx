"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Provider = "openai" | "gemini";
type State = { jarvisProvider: Provider; dualProviderReady: boolean; providers: Record<Provider, boolean> };

export default function JarvisControl() {
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    fetch("/api/jarvis-settings").then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Jarvis ayarı yüklenemedi.");
      setState(data as State);
    }).catch(cause => setError(cause instanceof Error ? cause.message : "Jarvis ayarı yüklenemedi."));
  }, []);

  async function selectProvider(provider: Provider) {
    setError(""); setMessage(""); setBusy(true);
    try {
      const response = await fetch("/api/jarvis-settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Jarvis sağlayıcısı değiştirilemedi.");
      setState(current => current ? { ...current, jarvisProvider: provider } : current);
      setMessage(`${provider === "openai" ? "ChatGPT" : "Gemini"} Jarvis için seçildi.`);
      router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Jarvis sağlayıcısı değiştirilemedi."); }
    finally { setBusy(false); }
  }

  return <section className="jarvis-control-card">
    <div className="jarvis-control-copy"><span className="eyebrow">JARVIS · KİŞİSEL ÖĞRENME ASİSTANI</span><h2>Öğrenme sistemini konuşarak yönet</h2><p>İlerlemeni analiz eder, çalışma hedefini ve aktif programını günceller. Bu sağlayıcı Jarvis sohbetini, planlarını ve canlı dersini yönetir.</p></div>
    <div className="jarvis-provider-select"><label htmlFor="jarvis-provider">Jarvis motoru</label><select id="jarvis-provider" value={state?.jarvisProvider || "openai"} disabled={!state || busy || !state.dualProviderReady} onChange={event => void selectProvider(event.target.value as Provider)}>
      <option value="openai" disabled={state ? !state.providers.openai : false}>ChatGPT{state && !state.providers.openai ? " · API anahtarı ekle" : ""}</option>
      <option value="gemini" disabled={state ? !state.providers.gemini : false}>Gemini{state && !state.providers.gemini ? " · API anahtarı ekle" : ""}</option>
    </select>
    <a href="/setup/ai">Sağlayıcı anahtarlarını yönet →</a></div>
    {!state?.dualProviderReady && state && <p className="jarvis-migration-hint">İki motoru ayrı kaydetmek için Supabase&apos;te <code>supabase/migrations/0008_jarvis_dual_ai_providers.sql</code> dosyasını çalıştır.</p>}
    {state && !state.providers[state.jarvisProvider] && <p className="jarvis-migration-hint">Seçili motor için kişisel API anahtarı eklemeden Jarvis çalışamaz.</p>}
    {busy && <p role="status" className="muted">Jarvis motoru değiştiriliyor…</p>}{message && <p role="status" className="ok">{message}</p>}{error && <p role="alert" className="error">{error}</p>}
  </section>;
}
