-- Yönetici panelinden AI sağlayıcısı ve API anahtarı tanımlamak için güvenli kayıt.
-- Anahtar uygulama tarafından AES-256-GCM ile şifrelenir; şifreleme anahtarı APP_ENCRYPTION_KEY env değişkenidir.
create table if not exists public.platform_ai_settings (
  id text primary key check (id = 'default'),
  provider text not null check (provider in ('gemini', 'openai')),
  model text not null,
  api_key_ciphertext text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.platform_ai_settings enable row level security;
revoke all on public.platform_ai_settings from anon, authenticated;
grant all on public.platform_ai_settings to service_role;

-- Bu kayıtlar yalnızca güvenilir sunucu endpoint'leri üzerinden oluşturulmalıdır.
drop policy if exists learning_plans_own_insert on public.learning_plans;
drop policy if exists voice_sessions_own_insert on public.voice_sessions;
drop policy if exists writing_submissions_own_insert on public.writing_submissions;
