"use client";
import Speak from "@/components/Speak";
export type PQ = { id: string; skill: string; passage: string | null; audio_text: string | null; prompt: string; options: string[] };
export default function Question({ q, value, onChange, locked, answer }: { q: PQ; value: string; onChange: (v: string) => void; locked?: boolean; answer?: string }) {
  return <div>
    {q.passage && <div className="passage">{q.passage}</div>}
    {q.audio_text && <p><Speak text={q.audio_text} label="🔊 Metni dinle" rate={0.85} /> <span className="muted"> Metin gösterilmez; dilediğin kadar dinleyebilirsin.</span></p>}
    <p style={{ fontWeight: 700 }}>{q.prompt}</p>
    {q.options.map(o => {
      const cls = ["opt", value === o ? "sel" : "", locked && answer ? (o === answer ? "good" : value === o ? "wrong" : "") : ""].join(" ");
      return <label key={o} className={cls}><input type="radio" name={q.id} checked={value === o} disabled={locked} onChange={() => onChange(o)} /> {o}</label>;
    })}
  </div>;
}
