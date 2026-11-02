-- 0003: Platform şeması. Yalnızca ekleme yapar, mevcut veriyi silmez.
alter table public.profiles add column if not exists active boolean not null default true;
alter table public.profiles add column if not exists target_level text not null default 'A2';
alter table public.profiles add column if not exists admin_goal text;
alter table public.profiles add column if not exists xp int not null default 0;

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin' and active)
$$;

-- Kullanıcı yalnızca bu alanları değiştirebilir (cefr_level, xp, role, active, admin_goal sunucu tarafından yönetilir).
revoke update on public.profiles from authenticated, anon;
grant update (display_name, learning_goal, daily_minutes, target_level) on public.profiles to authenticated;
drop policy if exists profile_admin_read on public.profiles;
create policy profile_admin_read on public.profiles for select to authenticated using (public.is_admin());

create table if not exists public.courses(id text primary key, level text not null, title text not null, description text, position int not null default 0);
create table if not exists public.lessons(id text primary key, course_id text not null references public.courses(id) on delete cascade, level text not null, title text not null, intro_tr text, points jsonb not null default '[]', examples jsonb not null default '[]', position int not null default 0);
create table if not exists public.vocabulary(id serial primary key, de text not null unique, article text, plural text, tr text not null, example_de text, example_tr text, level text not null, category text not null);
create table if not exists public.grammar_topics(id text primary key, level text not null, title text not null, explanation_tr text not null, comparisons jsonb not null default '[]', position int not null default 0);
create table if not exists public.exercises(id text primary key, skill text not null check (skill in ('lesen','horen','grammatik','wortschatz')), level text not null check (level in ('A1','A2')), grp text, passage text, audio_text text, prompt text not null, options jsonb not null, answer text not null, explanation text, lesson_id text references public.lessons(id) on delete cascade, grammar_id text references public.grammar_topics(id) on delete cascade);

create table if not exists public.exercise_attempts(id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, exercise_id text not null references public.exercises(id) on delete cascade, answer text, correct boolean not null, created_at timestamptz not null default now());
create table if not exists public.lesson_progress(user_id uuid not null references auth.users(id) on delete cascade, lesson_id text not null references public.lessons(id) on delete cascade, score int not null, completed_at timestamptz not null default now(), primary key (user_id, lesson_id));
create table if not exists public.vocabulary_progress(user_id uuid not null references auth.users(id) on delete cascade, vocab_id int not null references public.vocabulary(id) on delete cascade, ease real not null default 2.5, interval_days int not null default 0, reps int not null default 0, lapses int not null default 0, due_at timestamptz not null default now(), favorite boolean not null default false, learned boolean not null default false, last_reviewed timestamptz, primary key (user_id, vocab_id));
create table if not exists public.learning_plans(id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, assessment_id uuid references public.assessments(id) on delete set null, plan jsonb not null, active boolean not null default true, created_at timestamptz not null default now());
create table if not exists public.voice_sessions(id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, scenario text not null, transcript jsonb not null default '[]', avg_confidence real, seconds int not null default 0, created_at timestamptz not null default now());
create table if not exists public.writing_submissions(id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, task text not null, original text not null, corrected text, feedback jsonb not null default '{}', level text, score int, created_at timestamptz not null default now());
create table if not exists public.exam_sessions(id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, level text not null, skill text not null, question_ids jsonb not null, duration_s int not null, started_at timestamptz not null default now(), finished_at timestamptz, status text not null default 'running');
create table if not exists public.exam_answers(session_id uuid not null references public.exam_sessions(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, exercise_id text not null references public.exercises(id) on delete cascade, answer text, correct boolean not null, primary key (session_id, exercise_id));
create table if not exists public.exam_results(session_id uuid primary key references public.exam_sessions(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, score int not null, total int not null, pct int not null, by_skill jsonb not null default '{}', created_at timestamptz not null default now());
create table if not exists public.study_sessions(id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, kind text not null, seconds int not null check (seconds between 1 and 3600), created_at timestamptz not null default now());
create table if not exists public.achievements(user_id uuid not null references auth.users(id) on delete cascade, code text not null, earned_at timestamptz not null default now(), primary key (user_id, code));
create table if not exists public.notifications(id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, title text not null, body text, kind text not null default 'info', read boolean not null default false, created_at timestamptz not null default now());
create table if not exists public.user_settings(user_id uuid primary key references auth.users(id) on delete cascade, theme text not null default 'dark' check (theme in ('light','dark')), ui_lang text not null default 'tr', voice_rate real not null default 0.9, notify_daily boolean not null default true, notify_weekly boolean not null default true);
create table if not exists public.ai_usage(id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, kind text not null, created_at timestamptz not null default now());

create index if not exists idx_attempts_user on public.exercise_attempts(user_id, created_at desc);
create index if not exists idx_vocabprog_due on public.vocabulary_progress(user_id, due_at);
create index if not exists idx_study_user on public.study_sessions(user_id, created_at desc);
create index if not exists idx_exam_user on public.exam_sessions(user_id, started_at desc);
create index if not exists idx_notif_user on public.notifications(user_id, created_at desc);
create index if not exists idx_aiusage_user on public.ai_usage(user_id, kind, created_at desc);
create index if not exists idx_exercises_pool on public.exercises(skill, level);

alter table public.courses enable row level security; alter table public.lessons enable row level security;
alter table public.vocabulary enable row level security; alter table public.grammar_topics enable row level security;
alter table public.exercises enable row level security; -- politika yok: soru cevapları yalnızca sunucudan (service role) okunur
alter table public.ai_usage enable row level security;
alter table public.exercise_attempts enable row level security; alter table public.lesson_progress enable row level security;
alter table public.vocabulary_progress enable row level security; alter table public.learning_plans enable row level security;
alter table public.voice_sessions enable row level security; alter table public.writing_submissions enable row level security;
alter table public.exam_sessions enable row level security; alter table public.exam_answers enable row level security;
alter table public.exam_results enable row level security; alter table public.study_sessions enable row level security;
alter table public.achievements enable row level security; alter table public.notifications enable row level security;
alter table public.user_settings enable row level security;

do $$ declare t text; begin
  foreach t in array array['courses','lessons','vocabulary','grammar_topics'] loop
    execute format('drop policy if exists %I on public.%I', t||'_read', t);
    execute format('create policy %I on public.%I for select to authenticated using (true)', t||'_read', t);
  end loop;
  -- Kullanıcı kendi satırlarını okur
  foreach t in array array['exercise_attempts','lesson_progress','vocabulary_progress','learning_plans','voice_sessions','writing_submissions','exam_sessions','exam_answers','exam_results','study_sessions','achievements','notifications','user_settings'] loop
    execute format('drop policy if exists %I on public.%I', t||'_own_read', t);
    execute format('create policy %I on public.%I for select to authenticated using (auth.uid() = user_id)', t||'_own_read', t);
  end loop;
  -- Kullanıcının kendi adına yazabildiği tablolar (sonuç/sınav/xp tabloları hariç: onlar sunucudan yazılır)
  foreach t in array array['vocabulary_progress','learning_plans','voice_sessions','writing_submissions','study_sessions','user_settings'] loop
    execute format('drop policy if exists %I on public.%I', t||'_own_insert', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (auth.uid() = user_id)', t||'_own_insert', t);
  end loop;
  foreach t in array array['vocabulary_progress','user_settings','notifications'] loop
    execute format('drop policy if exists %I on public.%I', t||'_own_update', t);
    execute format('create policy %I on public.%I for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', t||'_own_update', t);
  end loop;
  -- Yönetici okuma (sohbet içeriği hariç: mahremiyet)
  foreach t in array array['assessments','lesson_progress','vocabulary_progress','learning_plans','writing_submissions','exam_sessions','exam_results','study_sessions','achievements','exercise_attempts','voice_sessions'] loop
    execute format('drop policy if exists %I on public.%I', t||'_admin_read', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_admin())', t||'_admin_read', t);
  end loop;
end $$;
