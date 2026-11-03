"use client";

import { useEffect, useRef, useState } from "react";

type Entry = { role: "user" | "assistant"; content: string };
type LiveMessage = {
  setupComplete?: Record<string, never>;
  serverContent?: {
    inputTranscription?: { text?: string };
    outputTranscription?: { text?: string };
    modelTurn?: { parts?: Array<{ inlineData?: { data?: string } }> };
    turnComplete?: boolean;
    interrupted?: boolean;
  };
  error?: { message?: string };
};
const SCENARIOS: Record<string, string> = {
  vorstellen: "Kennenlernen und sich vorstellen",
  einkaufen: "Im Supermarkt einkaufen",
  restaurant: "Im Restaurant bestellen",
  arzt: "Beim Arzt einen Termin vereinbaren",
  weg: "Nach dem Weg fragen"
};
const MODEL = "models/gemini-3.8-live";

function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}
function downsample(input: Float32Array, rate: number) {
  const ratio = rate / 16000;
  const length = Math.floor(input.length / ratio);
  const pcm = new ArrayBuffer(length * 2);
  const view = new DataView(pcm);
  for (let i = 0; i < length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(Math.floor((i + 1) * ratio), input.length);
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j];
    const sample = Math.max(-1, Math.min(1, sum / Math.max(1, end - start)));
    view.setInt16(i * 2, sample < 0 ? sample * 32768 : sample * 32767, true);
  }
  return new Uint8Array(pcm);
}
function decodePcm(base64: string, context: AudioContext) {
  const binary = atob(base64);
  const samples = new Float32Array(Math.floor(binary.length / 2));
  for (let i = 0; i < samples.length; i++) {
    const value = (binary.charCodeAt(i * 2) | (binary.charCodeAt(i * 2 + 1) << 8));
    const signed = value > 32767 ? value - 65536 : value;
    samples[i] = signed / 32768;
  }
  const buffer = context.createBuffer(1, samples.length, 24000);
  buffer.copyToChannel(samples, 0);
  return buffer;
}

export default function GeminiLiveTutor({ level }: { level: "A1" | "A2" }) {
  const [scenario, setScenario] = useState("vorstellen");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [draftUser, setDraftUser] = useState("");
  const [draftAI, setDraftAI] = useState("");
  const [typed, setTyped] = useState("");
  const [status, setStatus] = useState("Hazır");
  const [error, setError] = useState("");
  const [active, setActive] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const muteRef = useRef<GainNode | null>(null);
  const historyRef = useRef<Entry[]>([]);
  const inputDraftRef = useRef("");
  const outputDraftRef = useRef("");
  const nextPlayRef = useRef(0);
  const soundsRef = useRef(new Set<AudioBufferSourceNode>());
  const startedRef = useRef(0);

  function addEntry(entry: Entry) {
    const next = [...historyRef.current, entry].slice(-60);
    historyRef.current = next;
    setEntries(next);
  }
  function commitDrafts() {
    const user = inputDraftRef.current.trim();
    const assistant = outputDraftRef.current.trim();
    if (user) addEntry({ role: "user", content: user });
    if (assistant) addEntry({ role: "assistant", content: assistant });
    inputDraftRef.current = "";
    outputDraftRef.current = "";
    setDraftUser("");
    setDraftAI("");
  }
  function clearAudio() {
    for (const sound of soundsRef.current) {
      try { sound.stop(); } catch {}
    }
    soundsRef.current.clear();
    nextPlayRef.current = 0;
  }
  function release(updateState = true) {
    const socket = socketRef.current;
    socketRef.current = null;
    if (socket && socket.readyState < WebSocket.CLOSING) socket.close();
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    muteRef.current?.disconnect();
    processorRef.current = null;
    sourceRef.current = null;
    muteRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    const context = contextRef.current;
    contextRef.current = null;
    clearAudio();
    if (context && context.state !== "closed") void context.close();
    if (updateState) setActive(false);
  }

  async function stopAndSave() {
    const seconds = startedRef.current ? Math.round((Date.now() - startedRef.current) / 1000) : 0;
    commitDrafts();
    release();
    setStatus("Kaydediliyor…");
    if (historyRef.current.length) {
      const response = await fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          scenario: "live-" + scenario,
          seconds,
          avg_confidence: null,
          transcript: historyRef.current
        })
      }).catch(() => null);
      if (!response?.ok) setError("Konuşma bitti ancak oturum kaydedilemedi.");
    }
    setStatus("Oturum kapandı");
  }

  async function start() {
    setError("");
    setStatus("Mikrofon hazırlanıyor…");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;
      const context = new AudioContext();
      contextRef.current = context;
      await context.resume();

      const tokenResponse = await fetch("/api/live-token", { method: "POST" });
      const tokenData = await tokenResponse.json().catch(() => ({}));
      if (!tokenResponse.ok) throw new Error(tokenData.error || "Canlı oturum başlatılamadı.");

      const socket = new WebSocket("wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=" + encodeURIComponent(tokenData.token));
      socketRef.current = socket;
      setStatus("Gemini Live bağlanıyor…");

      await new Promise<void>((resolve, reject) => {
        const setupTimer = window.setTimeout(() => reject(new Error("Gemini Live zamanında bağlanmadı. Tekrar dene.")), 20000);
        socket.onerror = () => { window.clearTimeout(setupTimer); reject(new Error("Gemini Live bağlantısı kurulamadı. API anahtarını ve Gemini Live erişimini kontrol et.")); };
        socket.onclose = () => { window.clearTimeout(setupTimer); if (!active) reject(new Error("Canlı bağlantı kapandı.")); };
        socket.onopen = () => {
          socket.send(JSON.stringify({
            setup: {
              model: MODEL,
              generationConfig: {
                responseModalities: ["AUDIO"],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } } }
              },
              systemInstruction: { parts: [{ text: "Du bist ein freundlicher, geduldiger Deutschlehrer für türkischsprachige Lernende auf CEFR " + level + ". Übe mit dem Lernenden ein natürliches Gespräch im Szenario: " + SCENARIOS[scenario] + ". Sprich langsam und in kurzen, einfachen deutschen Sätzen auf dem Niveau " + level + ". Warte auf Antworten. Wenn der Lernende einen Grammatik- oder Wortfehler macht, wiederhole zuerst den korrigierten deutschen Satz und erkläre die Regel kurz auf Türkisch. Stelle danach genau eine passende kurze Frage auf Deutsch. Ermutige den Lernenden, aber gib nicht nur lange Vorträge. Wenn der Lernende Türkisch spricht, antworte kurz auf Türkisch und leite ihn zurück ins Deutsche." }] },
              inputAudioTranscription: {},
              outputAudioTranscription: {},
              realtimeInputConfig: { automaticActivityDetection: {} }
            }
          }));
        };
        socket.onmessage = event => {
          let message: LiveMessage;
          try { message = JSON.parse(String(event.data)); } catch { return; }
          if (message.error) { window.clearTimeout(setupTimer); reject(new Error(message.error.message || "Gemini Live bağlantı hatası.")); return; }
          if (message.setupComplete) {
            window.clearTimeout(setupTimer);
            resolve();
          }
        };
      });

      socket.onmessage = event => {
        let message: LiveMessage;
        try { message = JSON.parse(String(event.data)); } catch { return; }
        if (message.error) { setError(message.error.message || "Gemini Live bağlantı hatası."); setStatus("Bağlantı hatası"); return; }
        const content = message.serverContent;
        if (!content) return;
        if (content.interrupted) clearAudio();
        const inputText = content.inputTranscription?.text || "";
        const outputText = content.outputTranscription?.text || "";
        if (inputText) {
          inputDraftRef.current += inputText;
          setDraftUser(inputDraftRef.current);
        }
        if (outputText) {
          outputDraftRef.current += outputText;
          setDraftAI(outputDraftRef.current);
        }
        const context = contextRef.current;
        if (context && content.modelTurn?.parts) {
          for (const part of content.modelTurn.parts) {
            const audio = part.inlineData?.data;
            if (!audio) continue;
            const buffer = decodePcm(audio, context);
            const source = context.createBufferSource();
            source.buffer = buffer;
            source.connect(context.destination);
            const when = Math.max(context.currentTime + 0.04, nextPlayRef.current);
            source.start(when);
            nextPlayRef.current = when + buffer.duration;
            soundsRef.current.add(source);
            source.onended = () => soundsRef.current.delete(source);
            setStatus("Öğretmen konuşuyor…");
          }
        }
        if (content.turnComplete) {
          commitDrafts();
          setStatus("Dinliyorum…");
        }
      };

      socket.onclose = () => {
        if (socketRef.current === socket) {
          setActive(false);
          setStatus("Bağlantı kapandı");
        }
      };

      const inputSource = context.createMediaStreamSource(stream);
      const processor = context.createScriptProcessor(4096, 1, 1);
      const mute = context.createGain();
      mute.gain.value = 0;
      processor.onaudioprocess = event => {
        if (socket.readyState !== WebSocket.OPEN) return;
        const pcm = downsample(event.inputBuffer.getChannelData(0), context.sampleRate);
        if (!pcm.length) return;
        socket.send(JSON.stringify({ realtimeInput: { audio: { data: toBase64(pcm), mimeType: "audio/pcm;rate=16000" } } }));
      };
      inputSource.connect(processor);
      processor.connect(mute);
      mute.connect(context.destination);
      sourceRef.current = inputSource;
      processorRef.current = processor;
      muteRef.current = mute;
      startedRef.current = Date.now();
      socket.send(JSON.stringify({ realtimeInput: { text: "Hallo! Begrüße mich bitte und stelle mir eine einfache Frage zum Thema " + SCENARIOS[scenario] + "." } }));
      setActive(true);
      setStatus("Dinliyorum… konuşabilirsin");
    } catch (e) {
      release();
      const message = e instanceof Error ? e.message : "Canlı konuşma başlatılamadı.";
      setError(message.includes("Permission") || message.includes("NotAllowed") ? "Mikrofon izni gerekli. Tarayıcıdan bu site için mikrofon izni ver." : message);
      setStatus("Başlatılamadı");
    }
  }

  function sendText(event: React.FormEvent) {
    event.preventDefault();
    const message = typed.trim();
    const socket = socketRef.current;
    if (!message || !socket || socket.readyState !== WebSocket.OPEN) return;
    commitDrafts();
    addEntry({ role: "user", content: message });
    socket.send(JSON.stringify({ realtimeInput: { text: message } }));
    setTyped("");
    setStatus("Öğretmen yanıtlıyor…");
  }

  useEffect(() => () => release(false), []);

  return <section className="panel">
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <div><h2 style={{ margin: 0 }}>Gemini Live ile konuş</h2><p className="muted">Mikrofonla anlık konuş; AI öğretmenini duy, cevabını da canlı metin olarak gör. Almanca {level} pratiği.</p></div>
      <div className="field" style={{ minWidth: 210 }}><label htmlFor="live-scenario">Konuşma konusu</label><select id="live-scenario" value={scenario} disabled={active} onChange={e => setScenario(e.target.value)}>{Object.entries(SCENARIOS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
    </div>
    <div className="chat" aria-live="polite" style={{ minHeight: 130, maxHeight: 360, overflowY: "auto" }}>
      {!entries.length && !draftUser && !draftAI && <p className="muted">Başlatınca öğretmen seni karşılar. Cümle kurarken hata yapmaktan çekinme; öğretmen düzeltip kuralı açıklar.</p>}
      {entries.map((entry, index) => <div className={"msg " + entry.role} key={index}>{entry.content}</div>)}
      {draftUser && <div className="msg user">{draftUser}</div>}
      {draftAI && <div className="msg assistant">{draftAI}</div>}
    </div>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
      {!active ? <button className="btn" onClick={start} disabled={status.includes("bağlanıyor") || status.includes("hazırlanıyor")}>🎙️ Canlı konuşmayı başlat</button> : <button className="btn ghost" onClick={stopAndSave}>Oturumu bitir ve kaydet</button>}
      <span className="muted" style={{ alignSelf: "center" }}>{status}</span>
    </div>
    {active && <form onSubmit={sendText} style={{ display: "flex", gap: 8, marginTop: 10 }}>
      <input value={typed} onChange={e => setTyped(e.target.value)} maxLength={500} placeholder="İstersen yazarak da konuş…" aria-label="Gemini Live öğretmenine mesaj" />
      <button className="btn ghost" disabled={!typed.trim()}>Gönder</button>
    </form>}
    {error && <p role="alert" className="error">{error}</p>}
    <p className="muted" style={{ fontSize: 12 }}>Bu özellik kişisel Gemini API anahtarını kullanır; Google Gemini kullanım kotası ve ücretlendirmesi geçerlidir. Canlı oturum en fazla 15 dakika sürer.</p>
  </section>;
}