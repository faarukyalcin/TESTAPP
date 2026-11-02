"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export default function PlanButton() {
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const r = useRouter();
  return <><button className="btn ghost small" disabled={busy} onClick={async () => {
    setBusy(true); setErr("");
    const res = await fetch("/api/plan", { method: "POST" }); const d = await res.json().catch(() => ({}));
    setBusy(false); if (!res.ok) setErr(d.error || "Hata"); else r.refresh();
  }}>{busy ? "Plan güncelleniyor…" : "Planı ilerlememe göre güncelle"}</button>{err && <span className="error"> {err}</span>}</>;
}
