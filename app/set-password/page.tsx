"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
export default function SetPassword() {
  const [password,setPassword]=useState(""); const [confirm,setConfirm]=useState(""); const [message,setMessage]=useState(""); const [busy,setBusy]=useState(false);
  async function submit(e:React.FormEvent){e.preventDefault();setMessage("");if(password.length<10){setMessage("Şifre en az 10 karakter olmalı.");return;}if(password!==confirm){setMessage("Şifreler eşleşmiyor.");return;}setBusy(true);const{error}=await supabaseBrowser().auth.updateUser({password});setBusy(false);if(error){setMessage(error.message);return;}location.href="/";}
  return <main className="wrap" style={{maxWidth:520,paddingTop:"8vh"}}><div className="brand">Deutsch<b>AI</b></div><section className="panel"><h1>Şifreni oluştur</h1><p className="muted">Davet bağlantını doğruladın. Hesabın için güçlü bir şifre belirle.</p><form onSubmit={submit}><div className="field"><label>Yeni şifre</label><input type="password" minLength={10} required value={password} onChange={e=>setPassword(e.target.value)}/></div><div className="field"><label>Şifreyi tekrar gir</label><input type="password" required value={confirm} onChange={e=>setConfirm(e.target.value)}/></div>{message&&<p className="error">{message}</p>}<button className="btn" disabled={busy}>{busy?"Kaydediliyor…":"Şifreyi kaydet"}</button></form></section></main>;
}
