-- Her öğrenci kendi AI sağlayıcısını ve şifrelenmiş API anahtarını yönetir.
create table if not exists public.user_ai_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider text not null check (provider in ('gemini', 'openai')),
  model text not null,
  api_key_ciphertext text not null,
  updated_at timestamptz not null default now()
);

alter table public.user_ai_settings enable row level security;
revoke all on public.user_ai_settings from anon;
grant select, insert, update, delete on public.user_ai_settings to authenticated;
drop policy if exists user_ai_settings_select_own on public.user_ai_settings;
create policy user_ai_settings_select_own on public.user_ai_settings
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists user_ai_settings_insert_own on public.user_ai_settings;
create policy user_ai_settings_insert_own on public.user_ai_settings
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists user_ai_settings_update_own on public.user_ai_settings;
create policy user_ai_settings_update_own on public.user_ai_settings
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists user_ai_settings_delete_own on public.user_ai_settings;
create policy user_ai_settings_delete_own on public.user_ai_settings
  for delete to authenticated using (auth.uid() = user_id);

