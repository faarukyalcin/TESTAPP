-- Persist generated lessons and feedback. Students can read only their own rows.
create table if not exists public.ai_lessons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  level text not null check (level in ('A1','A2')),
  topic text not null,
  content jsonb not null,
  feedback jsonb,
  created_at timestamptz not null default now()
);
alter table public.ai_lessons enable row level security;
revoke all on public.ai_lessons from anon, authenticated;
grant select on public.ai_lessons to authenticated;
grant all on public.ai_lessons to service_role;
drop policy if exists ai_lessons_own_read on public.ai_lessons;
create policy ai_lessons_own_read on public.ai_lessons for select to authenticated using (auth.uid() = user_id);
create index if not exists ai_lessons_user_created_idx on public.ai_lessons(user_id, created_at desc);
