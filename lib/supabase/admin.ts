import { createClient } from "@supabase/supabase-js";
// Yalnızca sunucu kodundan import edilmelidir (service role anahtarı tarayıcıya gitmez).
export function supabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
