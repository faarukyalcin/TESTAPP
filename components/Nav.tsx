"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
const ITEMS: [string, string][] = [["/", "Panel"], ["/lessons", "Dersler"], ["/vocabulary", "Kelimeler"], ["/grammar", "Gramer"], ["/practice/lesen", "Lesen"], ["/practice/horen", "Hören"], ["/writing", "Schreiben"], ["/voice", "Sprechen"], ["/learn", "AI Öğretmen"], ["/exam", "Sınav"], ["/progress", "İlerleme"]];
export default function Nav({ unread, admin }: { unread: number; admin: boolean }) {
  const p = usePathname();
  const on = (h: string) => (h === "/" ? p === "/" : p.startsWith(h));
  return <nav className="nav" aria-label="Ana menü">
    <Link href="/" className="brand" style={{ marginRight: 10, textDecoration: "none", color: "inherit" }}>Deutsch<b>AI</b></Link>
    {ITEMS.map(([h, l]) => <Link key={h} href={h} className={on(h) ? "on" : ""}>{l}</Link>)}
    <span className="sp" />
    {admin && <Link href="/admin" className={on("/admin") ? "on" : ""}>Yönetim</Link>}
    <Link href="/notifications" className={on("/notifications") ? "on" : ""}>🔔{unread > 0 && <span className="badge">{unread}</span>}</Link>
    <Link href="/profile" className={on("/profile") ? "on" : ""}>Profil</Link>
    <button className="btn ghost small" onClick={async () => { await supabaseBrowser().auth.signOut(); location.href = "/login"; }}>Çıkış</button>
  </nav>;
}
