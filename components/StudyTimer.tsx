"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
// Sekme görünürken geçen gerçek süreyi (60 sn'lik dilimlerle) kaydeder.
export default function StudyTimer() {
  const path = usePathname();
  const kind = (path.split("/")[1] || "panel").slice(0, 30);
  const acc = useRef(0);
  useEffect(() => {
    let last = Date.now();
    const flush = (keepalive = false) => {
      const s = Math.min(300, Math.round(acc.current));
      if (s >= 5) { acc.current = 0; fetch("/api/study", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, seconds: s }), keepalive }).catch(() => {}); }
    };
    const tick = setInterval(() => {
      const now = Date.now();
      if (document.visibilityState === "visible") acc.current += Math.min(5, (now - last) / 1000);
      last = now;
      if (acc.current >= 60) flush();
    }, 5000);
    const onHide = () => { if (document.visibilityState === "hidden") flush(true); };
    document.addEventListener("visibilitychange", onHide);
    return () => { clearInterval(tick); document.removeEventListener("visibilitychange", onHide); flush(true); };
  }, [kind]);
  return null;
}
