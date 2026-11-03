"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export default function PlanButton() {
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [done, setDone] = useState(false); const r = useRouter();
  return <><button className="btn ghost small" disabled={busy} onClick={async () => {
    setBusy(true); setErr(""); setDone(false);
    try {
      const res = await fetch("/api/plan", { method: "POST" }); const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Program güncellenemedi.");
      setDone(true); r.refresh();
    } catch (e) { setErr(e instanceof Error ? e.message : "Program güncellenemedi."); }
    finally { setBusy(false); }
  }}>{busy ? "Program yenileniyor…" : "Programı ilerlememe göre yeniden yap"}</button>{done && <span className="ok" role="status"> Yeni program aktifleştirildi.</span>}{err && <span className="error"> {err}</span>}</>;
}
