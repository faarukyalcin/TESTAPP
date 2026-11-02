"use client";
import { useRef, useState } from "react";
import { speak } from "@/lib/speech";
const SCEN: Record<string, string> = { vorstellen: "Tanışma", einkaufen: "Alışveriş", restaurant: "Restoran", arzt: "Doktor randevusu", weg: "Yol tarifi" };
type T = { role: "user" | "assistant"; content: string; confidence?: number; correction?: string | null };
export default function VoiceClient({ rate }: { rate: number }) {
  const [scenario, setScenario] = useState("vorstellen"); const [log, setLog] = useState<T[]>([]); const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [typed, setTyped] = useState(""); const [saved, setSaved] = useState(false);
  const started = useRef<number>(0);
  const SR = typeof window !== "undefined" ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) : null;

  async function turn(text: string, confidence?: number) {
    if (!started.current) started.current = Date.now();
    const history = log.map(({ role, content }) => ({ role, content }));
    setLog(l => [...l, { role: "user", content: text, confidence }]); setBusy(true); setErr(""); setSaved(false);
    try {
      const r = await fetch("/api/voice", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "turn", scenario, message: text, history: history.slice(-10) }) });
      const d = await r.json(); if (!r.ok) throw Error(d.error);
      setLog(l => [...l, { role: "assistant", content: d.reply_de, correction: d.correction_tr }]);
      if (!speak(d.reply_de, rate)) setErr("Sesli yanıt için tarayıcın metin okumayı desteklemiyor; yanıt yazıyla gösterildi.");
    } catch (e) { setErr(e instanceof Error ? e.message : "Hata"); } finally { setBusy(false); }
  }
  function listen() {
    setErr("");
    if (!SR) { setErr("Bu tarayıcı konuşma tanımayı desteklemiyor. Chrome veya Edge kullan ya da aşağıya yazarak devam et."); return; }
    const r = new SR(); r.lang = "de-DE"; r.interimResults = false; r.maxAlternatives = 1;
    r.onstart = () => setListening(true); r.onend = () => setListening(false);
    r.onresult = (ev: any) => { const a = ev.results[0][0]; turn(a.transcript, a.confidence); };
    r.onerror = (ev: any) => {
      const m: Record<string, string> = { "not-allowed": "Mikrofon izni verilmedi. Adres çubuğundaki kilit simgesinden izin ver.", "service-not-allowed": "Mikrofon izni verilmedi.", "no-speech": "Ses algılanmadı. Tekrar dene.", "audio-capture": "Mikrofon bulunamadı.", network: "Konuşma tanıma servisine bağlanılamadı. İnternetini kontrol et." };
      setErr(m[ev.error] || `Konuşma tanıma hatası: ${ev.error}`); setListening(false);
    };
    try { r.start(); } catch { setErr("Mikrofon başlatılamadı."); }
  }
  async function finish() {
    const users = log.filter(x => x.role === "user" && x.confidence != null);
    const avg = users.length ? users.reduce((a, b) => a + (b.confidence || 0), 0) / users.length : null;
    const r = await fetch("/api/voice", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save", scenario, seconds: Math.round((Date.now() - started.current) / 1000), avg_confidence: avg, transcript: log.map(({ role, content, confidence }) => ({ role, content, ...(confidence != null ? { confidence } : {}) })) }) });
    if (r.ok) { setSaved(true); setLog([]); started.current = 0; } else setErr("Oturum kaydedilemedi.");
  }
  return <section className="panel">
    <div className="field"><label>Senaryo</label><select value={scenario} onChange={e => { setScenario(e.target.value); setLog([]); started.current = 0; }}>{Object.entries(SCEN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
    <div className="chat">{log.map((x, i) => <div key={i} className={`msg ${x.role}`}>{x.content}{x.role === "user" && x.confidence != null && <div style={{ fontSize: 12, opacity: .8 }}>tanıma güveni %{Math.round(x.confidence * 100)}{x.confidence < 0.7 ? " — telaffuzu tekrar dene" : ""}</div>}{x.correction && <div className="muted" style={{ marginTop: 6 }}>✏️ {x.correction}</div>}</div>)}</div>
    <button className="btn" onClick={listen} disabled={listening || busy}>{listening ? "Dinliyorum… 🎙️" : busy ? "AI yanıtlıyor…" : "🎙️ Konuş"}</button>{" "}
    {log.length > 1 && <button className="btn ghost" onClick={finish}>Oturumu bitir ve kaydet</button>}
    <div className="field"><label>Mikrofon yoksa yazarak devam et</label><input value={typed} onChange={e => setTyped(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && typed.trim() && !busy) { turn(typed.trim()); setTyped(""); } }} placeholder="Hallo, ich heiße …" /></div>
    {err && <p className="error">{err}</p>}{saved && <p className="ok">Oturum kaydedildi ✓</p>}
  </section>;
}
