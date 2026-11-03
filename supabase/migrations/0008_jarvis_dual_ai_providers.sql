-- Keep separate encrypted Gemini and OpenAI credentials and a dedicated Jarvis provider choice.
alter table public.user_ai_settings
  add column if not exists gemini_model text,
  add column if not exists gemini_api_key_ciphertext text,
  add column if not exists openai_model text,
  add column if not exists openai_api_key_ciphertext text,
  add column if not exists jarvis_provider text not null default 'openai'
    check (jarvis_provider in ('gemini', 'openai'));

-- Preserve the existing provider key and use ChatGPT as Jarvis's preferred engine by default.
update public.user_ai_settings
set gemini_model = case when provider = 'gemini' then model else gemini_model end,
    gemini_api_key_ciphertext = case when provider = 'gemini' then api_key_ciphertext else gemini_api_key_ciphertext end,
    openai_model = case when provider = 'openai' then model else openai_model end,
    openai_api_key_ciphertext = case when provider = 'openai' then api_key_ciphertext else openai_api_key_ciphertext end;

comment on column public.user_ai_settings.jarvis_provider is 'The provider selected for Jarvis chat, plan control, and live tutoring.';
