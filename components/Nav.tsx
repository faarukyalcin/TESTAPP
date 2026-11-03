"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

const GROUPS: { label: string; items: [string, string, string][] }[] = [
  { label: "GENEL", items: [["/", "Panel", "grid"], ["/lessons", "Dersler", "book"], ["/vocabulary", "Kelimeler", "cards"], ["/grammar", "Gramer", "grammar"]] },
  { label: "DİL BECERİLERİ", items: [["/practice/lesen", "Okuma", "read"], ["/practice/horen", "Dinleme", "listen"], ["/writing", "Yazma", "write"], ["/voice", "Konuşma", "speak"]] },
  { label: "ÖĞRENME", items: [["/learn", "AI öğretmen", "spark"], ["/exam", "Deneme sınavı", "exam"], ["/progress", "İlerleme", "chart"]] }
];

const ICONS: Record<string, string> = {
  grid: "M3 3h7v7H3z M14 3h7v7h-7z M14 14h7v7h-7z M3 14h7v7H3z",
  book: "M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z M4 5.5v16 M8 7h8 M8 11h8",
  cards: "M8 4H20v15H8z M5 7H4v14h12v-2 M11 8h6 M11 12h6",
  grammar: "M4 5h16 M7 3v4 M17 3v4 M6 11h12 M8 15h8 M10 19h4",
  read: "M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z M4 5.5v16 M8 7h8 M8 11h8 M8 15h5",
  listen: "M4 13v-2a8 8 0 0 1 16 0v2 M4 13H3v5h4v-5z M20 13h1v5h-4v-5z M17 19a5 5 0 0 1-5 3",
  write: "M12 20h9 M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4z",
  speak: "M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z",
  spark: "m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z M19 15l1.1 2.9L23 19l-2.9 1.1L19 23l-1.1-2.9L15 19l2.9-1.1z",
  exam: "M8 3h8l4 4v14H4V3z M15 3v5h5 M8 13h8 M8 17h6",
  chart: "M3 3v18h18 M8 15l4-4 4 3 5-7"
};

function Icon({ name }: { name: string }) {
  return <svg className="sidebar-icon" viewBox="0 0 24 24" aria-hidden="true"><path d={ICONS[name] || ICONS.grid} /></svg>;
}

export default function Nav({ unread, admin }: { unread: number; admin: boolean }) {
  const pathname = usePathname();
  const isActive = (href: string) => href === "/" ? pathname === "/" : pathname.startsWith(href);

  return <aside className="sidebar" aria-label="DeutschAI menüsü">
    <Link href="/" className="brand-lockup" aria-label="DeutschAI ana panel">
      <span className="brand-mark">D</span>
      <span className="brand-copy"><b>Deutsch<span>AI</span></b><small>ALMANCA ÖĞRENME</small></span>
    </Link>

    <nav className="sidebar-scroll" aria-label="Öğrenme menüsü">
      {GROUPS.map(group => <div className="sidebar-section" key={group.label}>
        <p className="sidebar-label">{group.label}</p>
        {group.items.map(([href, label, icon]) => <Link key={href} href={href} className={`sidebar-link ${isActive(href) ? "active" : ""}`} aria-current={isActive(href) ? "page" : undefined}>
          <Icon name={icon} /><span>{label}</span>
        </Link>)}
      </div>)}
    </nav>

    <div className="sidebar-bottom">
      <Link href="/notifications" className={`sidebar-link utility-link ${isActive("/notifications") ? "active" : ""}`} aria-current={isActive("/notifications") ? "page" : undefined}>
        <span className="notification-icon"><Icon name="speak" /></span><span>Bildirimler</span>{unread > 0 && <span className="badge">{unread}</span>}
      </Link>
      {admin && <Link href="/admin" className={`sidebar-link utility-link ${isActive("/admin") ? "active" : ""}`}><Icon name="grid" /><span>Yönetim</span></Link>}
      <Link href="/profile" className={`sidebar-link utility-link ${isActive("/profile") ? "active" : ""}`}><Icon name="speak" /><span>Hesabım</span></Link>
      <button className="sidebar-logout" onClick={async () => { await supabaseBrowser().auth.signOut(); location.href = "/login"; }}>
        <svg className="sidebar-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 17l5-5-5-5M15 12H3 M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" /></svg>
        <span>Çıkış yap</span>
      </button>
    </div>
  </aside>;
}
