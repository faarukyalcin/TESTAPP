"use client";
import Speak from "@/components/Speak";
import AskTeacher from "@/components/AskTeacher";
export type PQ = { id: string; skill: string; passage: string | null; audio_text: string | null; prompt: string; options: string[] };
export default function Question({ q, value, onChange, locked, answer, explanation, allowAskTeacher = true }: { q: PQ; value: string; onChange: (v: string) => void; locked?: boolean; answer?: string; explanation?: string | null; allowAskTeacher?: boolean }) {
  return <div>
    {q.passage && <div className="passage">{q.passage}</div>}
    {q.audio_text && <p><Speak text={q.audio_text} label="🔊 Metni dinle" rate={0.85} /> <span className="muted"> Metin gösterilmez; dilediğin kadar dinleyebilirsin.</span></p>}
    <p style={{ fontWeight: 700 }}>{q.prompt}</p>
    {q.options.map(o => {
      const cls = ["opt", value === o ? "sel" : "", locked && answer ? (o === answer ? "good" : value === o ? "wrong" : "") : ""].join(" ");
      return <label key={o} className={cls}><input type="radio" name={q.id} checked={value === o} disabled={locked} onChange={() => onChange(o)} /> {o}</label>;
    })}
    {allowAskTeacher && <AskTeacher data={{ prompt: q.prompt, passage: q.passage, options: q.options, selected: value, checkedAnswer: locked ? answer : undefined, explanation: locked ? explanation : undefined, skill: q.skill }} />}
  </div>;
}
