"use client";
import { useState } from "react";
import { speak } from "@/lib/speech";
export default function Speak({ text, label = "🔊 Dinle", rate = 0.9 }: { text: string; label?: string; rate?: number }) {
  const [err, setErr] = useState("");
  return <>
    <button type="button" className="btn ghost small" onClick={() => setErr(speak(text, rate) ? "" : "Tarayıcın sesli okumayı desteklemiyor. Chrome veya Edge dene.")}>{label}</button>
    {err && <span className="error"> {err}</span>}
  </>;
}
