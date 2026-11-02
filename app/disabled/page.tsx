"use client";
import { supabaseBrowser } from "@/lib/supabase/client";
export default function Disabled() {
  return <main className="wrap" style={{ maxWidth: 520, paddingTop: "10vh" }}><div className="brand">Deutsch<b>AI</b></div>
    <section className="panel"><h1>Hesap devre dışı</h1><p className="muted">Bu hesap şu an kullanılamıyor. Bir hata olduğunu düşünüyorsan yöneticiyle iletişime geç.</p>
      <button className="btn" onClick={async () => { await supabaseBrowser().auth.signOut(); location.href = "/login"; }}>Çıkış yap</button></section></main>;
}
