"use client";

import { useEffect, useRef, useState } from "react";
import { extractDailyMinutesUpdate } from "@/lib/assistant-intent";
import { isPlanRegenerationRequest } from "@/lib/plan-intent";

type Entry = { role: "user" | "assistant"; content: string };
type RealtimeEvent = { type?: string; delta?: string; transcript?: string; error?: { message?: string } };

const SCENARIOS: Record<string, string> = {
  vorstellen: "Kennenlernen und sich vorstellen",
  einkaufen: "Im Supermarkt einkaufen",
  restaurant: "Im Restaurant bestellen",
  arzt: "Beim Arzt einen Termin vereinbaren",
  weg: "Nach dem Weg fragen"
};

function waitForIce(pc: RTCPeerConnection) {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise<void>(resolve => {
    const timeout = window.setTimeout(() => resolve(), 2500);
    pc.addEventListener("icegatheringstatechange", () => {
      if (pc.iceGatheringState === "complete") { window.clearTimeout(timeout); resolve(); }
    }, { once: true });
  });
}

export default function OpenAILiveTutor({ level }: { level: "A1" | "A2" }) {
  const [scenario, setScenario] = useState("vorstellen");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [draftUser, setDraftUser] = useState("");
  const [draftAI, setDraftAI] = useState("");
  const [typed, setTyped] = useState("");
  const [status, setStatus] = useState("Hazır");
  const [error, setError] = useState("");
  const [active, setActive] = useState(false);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const historyRef = useRef<Entry[]>([]);
  const userDraftRef = useRef("");
  const aiDraftRef = useRef("");
  const startedRef = useRef(0);
  const activeRef = useRef(false);
  const commandBusyRef = useRef(false);
  const responseActiveRef = useRef(false);

  function addEntry(entry: Entry) {
    historyRef.current = [...historyRef.current, entry].slice(-60);
    setEntries(historyRef.current);
  }

  function commitDrafts() {
    const user = userDraftRef.current.trim();
    const assistant = aiDraftRef.current.trim();
    if (user) addEntry({ role: "user", content: user });
    if (assistant) addEntry({ role: "assistant", content: assistant });
    userDraftRef.current = "";
    aiDraftRef.current = "";
    setDraftUser("");
    setDraftAI("");
  }

  function release() {
    activeRef.current = false;
    channelRef.current?.close();
    channelRef.current = null;
    peerRef.current?.close();
    peerRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    setActive(false);
  }

  async function finish() {
    const seconds = startedRef.current ? Math.round((Date.now() - startedRef.current) / 1000) : 0;
    commitDrafts();
    release();
    setStatus("Kaydediliyor…");
    if (historyRef.current.length) {
      const response = await fetch("/api/voice", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", scenario: "live-openai-" + scenario, seconds, avg_confidence: null,
          transcript: historyRef.current.map(entry => ({ ...entry, content: entry.content.slice(0, 500) })) })
      }).catch(() => null);
      if (!response?.ok) setError("Konuşma bitti ancak oturum kaydedilemedi.");
    }
    setStatus("Oturum kapandı");
  }

  function handleEvent(event: RealtimeEvent) {
    if (event.type === "response.created") {
      responseActiveRef.current = true;
    } else if (event.type === "conversation.item.input_audio_transcription.completed" && event.transcript) {
      userDraftRef.current = event.transcript;
      setDraftUser(event.transcript);
      if (extractDailyMinutesUpdate(event.transcript) != null || isPlanRegenerationRequest(event.transcript)) void runSystemCommand(event.transcript);
      else setStatus("Öğretmen yanıtlıyor…");
    } else if (event.type === "response.output_audio_transcript.delta" || event.type === "response.output_text.delta") {
      aiDraftRef.current += event.delta || "";
      setDraftAI(aiDraftRef.current);
      setStatus("Öğretmen konuşuyor…");
    } else if (event.type === "response.output_audio_transcript.done" || event.type === "response.output_text.done") {
      if (event.transcript) aiDraftRef.current = event.transcript;
      else if (event.type === "response.output_text.done" && event.transcript) aiDraftRef.current = event.transcript;
      setDraftAI(aiDraftRef.current);
    } else if (event.type === "response.done") {
      responseActiveRef.current = false;
      commitDrafts();
      setStatus("Dinliyorum… konuşabilirsin");
    } else if (event.type === "error") {
      setError(event.error?.message || "ChatGPT Live bağlantı hatası.");
      setStatus("Bağlantı hatası");
    }
  }

  async function runSystemCommand(message: string) {
    if (commandBusyRef.current) return;
    commandBusyRef.current = true;
    commitDrafts();
    setStatus("İlerlemen analiz ediliyor, program güncelleniyor…");
    const channel = channelRef.current;
    try {
      if (channel?.readyState === "open" && responseActiveRef.current) channel.send(JSON.stringify({ type: "response.cancel" }));
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Program güncellenemedi.");
      if (channel?.readyState === "open") {
        channel.send(JSON.stringify({ type: "response.create", response: { instructions: "The learning system completed this requested action: " + data.reply + " Tell the learner briefly in Turkish what changed, then ask what they want to practice next." } }));
        setStatus("Program güncellendi; öğretmen sonucu sesli anlatıyor…");
      } else {
        aiDraftRef.current = data.reply;
        setDraftAI(data.reply);
        commitDrafts();
        setStatus("Program güncellendi.");
      }
    } catch (cause) {
      const messageText = cause instanceof Error ? cause.message : "Program güncellenemedi.";
      setError(messageText);
      if (channel?.readyState === "open") channel.send(JSON.stringify({ type: "response.create", response: { instructions: "The requested learning-system action failed: " + messageText + " Explain briefly in Turkish that the current plan was preserved." } }));
      setStatus("Program korunuyor");
    } finally { commandBusyRef.current = false; }
  }

  async function start() {
    setError("");
    setStatus("Mikrofon hazırlanıyor…");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;
      const tokenResponse = await fetch("/api/live-token", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario, level })
      });
      const tokenData = await tokenResponse.json().catch(() => ({}));
      if (!tokenResponse.ok || typeof tokenData.token !== "string") throw new Error(tokenData.error || "ChatGPT Live oturumu başlatılamadı.");

      const pc = new RTCPeerConnection();
      peerRef.current = pc;
      for (const track of stream.getTracks()) pc.addTrack(track, stream);
      pc.ontrack = event => {
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = event.streams[0];
          void remoteAudioRef.current.play().catch(() => setError("Tarayıcı ses oynatmaya izin vermedi. Sayfaya dokunup tekrar dene."));
        }
      };
      const channel = pc.createDataChannel("oai-events");
      channelRef.current = channel;
      channel.onmessage = event => {
        try { handleEvent(JSON.parse(event.data) as RealtimeEvent); } catch { /* Ignore non-JSON events. */ }
      };
      channel.onopen = () => {
        channel.send(JSON.stringify({ type: "response.create", response: { instructions: "Begrüße den Lernenden kurz und stelle genau eine einfache Frage auf Deutsch zum Szenario: " + SCENARIOS[scenario] + "." } }));
      };
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitForIce(pc);
      const sdp = pc.localDescription?.sdp;
      if (!sdp) throw new Error("Ses bağlantısı hazırlanamadı.");
      const answer = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST", headers: { Authorization: `Bearer ${tokenData.token}`, "Content-Type": "application/sdp" }, body: sdp
      });
      if (!answer.ok) {
        const details = await answer.text().catch(() => "");
        throw new Error(details.includes("401") || answer.status === 401 ? "OpenAI Live anahtarı veya Realtime erişimi geçersiz." : `OpenAI Live bağlantısı kurulamadı (${answer.status}).`);
      }
      await pc.setRemoteDescription({ type: "answer", sdp: await answer.text() });
      startedRef.current = Date.now();
      activeRef.current = true;
      setActive(true);
      setStatus("Bağlandı; konuşabilirsin");
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" || pc.connectionState === "closed") {
          if (activeRef.current) { release(); setStatus("Bağlantı kapandı"); }
        }
      };
    } catch (cause) {
      release();
      const message = cause instanceof Error ? cause.message : "Canlı konuşma başlatılamadı.";
      setError(message.includes("NotAllowed") || message.includes("Permission") ? "Mikrofon izni gerekli. Tarayıcıdan bu site için mikrofon izni ver." : message);
      setStatus("Başlatılamadı");
    }
  }

  function sendText(event: React.FormEvent) {
    event.preventDefault();
    const text = typed.trim();
    const channel = channelRef.current;
    if (!text || !channel || channel.readyState !== "open") return;
    commitDrafts();
    addEntry({ role: "user", content: text });
    if (extractDailyMinutesUpdate(text) != null || isPlanRegenerationRequest(text)) {
      setTyped("");
      void runSystemCommand(text);
      return;
    }
    channel.send(JSON.stringify({ type: "conversation.item.create", item: { type: "message", role: "user", content: [{ type: "input_text", text }] } }));
    channel.send(JSON.stringify({ type: "response.create" }));
    setTyped("");
    setStatus("Öğretmen yanıtlıyor…");
  }

  useEffect(() => () => release(), []);

  return <section className="panel">
    <audio ref={remoteAudioRef} autoPlay />
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <div><h2 style={{ margin: 0 }}>ChatGPT Live ile konuş</h2><p className="muted">Mikrofonla anlık Almanca konuş; öğretmenin sesli yanıt verir ve konuşma metni ekranda görünür. Seviye: {level}.</p></div>
      <div className="field" style={{ minWidth: 210 }}><label htmlFor="openai-live-scenario">Konuşma konusu</label><select id="openai-live-scenario" value={scenario} disabled={active} onChange={e => setScenario(e.target.value)}>{Object.entries(SCENARIOS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
    </div>
    <div className="chat" aria-live="polite" style={{ minHeight: 130, maxHeight: 360, overflowY: "auto" }}>
      {!entries.length && !draftUser && !draftAI && <p className="muted">Başlatınca öğretmen seni karşılar. Hatalarını düzeltip kısa Türkçe açıklama yapar.</p>}
      {entries.map((entry, index) => <div className={"msg " + entry.role} key={index}>{entry.content}</div>)}
      {draftUser && <div className="msg user">{draftUser}</div>}
      {draftAI && <div className="msg assistant">{draftAI}</div>}
    </div>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
      {!active ? <button className="btn" onClick={start} disabled={status.includes("hazırlanıyor")}>🎙️ Canlı konuşmayı başlat</button> : <button className="btn ghost" onClick={finish}>Oturumu bitir ve kaydet</button>}
      <span className="muted" style={{ alignSelf: "center" }}>{status}</span>
    </div>
    {active && <form onSubmit={sendText} style={{ display: "flex", gap: 8, marginTop: 10 }}><input value={typed} onChange={e => setTyped(e.target.value)} maxLength={500} placeholder="İstersen yazarak da konuş…" aria-label="ChatGPT Live öğretmenine mesaj" /><button className="btn ghost" disabled={!typed.trim()}>Gönder</button></form>}
    {error && <p role="alert" className="error">{error}</p>}
    <p className="muted" style={{ fontSize: 12 }}>Kişisel OpenAI API anahtarınla Realtime oturumu açılır. OpenAI API kullanım ücreti ve kotası geçerlidir.</p>
  </section>;
}
