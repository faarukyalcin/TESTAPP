Warning: truncated output (original token count: 20507)
Total output lines: 336

create type public.app_role as enum ('admin','student');
create table public.profiles(id uuid primary key references auth.users(id) on delete cascade,display_name text,role public.app_role not null default 'student',cefr_level text,learning_goal text,daily_minutes int not null default 15,created_at timestamptz not null default now());
create table public.assessments(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,level text not null,input jsonb not null,strengths jsonb not null default '[]',weaknesses jsonb not null default '[]',plan jsonb not null default '{}',summary text,created_at timestamptz not null default now());
create table public.chat_messages(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,role text not null check(role in('user','assistant')),content text not null,created_at timestamptz not null default now());
create function public.new_profile() returns trigger language plpgsql security definer set search_path=public as $$ begin insert into public.profiles(id,display_name) values(new.id,coalesce(new.raw_user_meta_data->>'name','Öğrenci')) on conflict do nothing; return new; end; $$;
create trigger auth_user_profile after insert on auth.users for each row execute procedure public.new_profile();
alter table public.profiles enable row level security;alter table public.assessments enable row level security;alter table public.chat_messages enable row level security;
create policy profile_read on public.profiles for select to authenticated using(auth.uid()=id);
create policy profile_update on public.profiles for update to authenticated using(auth.uid()=id) with check(auth.uid()=id);
create policy assessment_read on public.assessments for select to authenticated using(auth.uid()=user_id);
create policy assessment_insert on public.assessments for insert to authenticated with check(auth.uid()=user_id);
create policy chat_read on public.chat_messages for select to authenticated using(auth.uid()=user_id);
create policy chat_insert on public.chat_messages for insert to authenticated with check(auth.uid()=user_id);
-- First admin: invite your own account in Supabase, then run:
-- update public.profiles set role='admin' where id=(select id from auth.users where email='YOUR_EMAIL');
-- Disable public sign-ups in Supabase Auth settings. Invite users only through /admin.
-- 0002: Kritik güvenlik düzeltmesi. Veri silmez, sadece yetki kısıtlar. Geri alma notu en altta.
-- Sorun: profile_update politikası kullanıcının KENDİ satırındaki TÜM sütunları güncellemesine izin
-- veriyordu; bir öğrenci role='admin' yapabilirdi. Aşağıda sütun bazlı yetki ile kapatılıyor.

revoke update on public.profiles from authenticated, anon;
grant update (display_name, learning_goal, daily_minutes, cefr_level) on public.profiles to authenticated;

-- Ek güvenlik katmanı: yetki ayarı ileride yanlışlıkla genişletilse bile rol değişimini engelle.
create or replace function public.block_role_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and coalesce(auth.role(), '') <> 'service_role'
     and current_user not in ('postgres', 'supabase_admin') then
    raise exception 'role cannot be changed';
  end if;
  return new;
end; $$;

drop trigger if exists profiles_block_role_change on public.profiles;
create trigger profiles_block_role_change before update on public.profiles
  for each row execute procedure public.block_role_change();

-- Sohbet hız sınırı sorgusu için indeks.
create index if not exists chat_messages_user_created_idx on public.chat_messages (user_id, created_at desc);
create index if not exists assessments_user_created_idx on public.assessments (user_id, created_at desc);

-- Geri alma (gerekirse):
--   drop trigger profiles_block_role_change on public.profiles;
--   grant update on public.profiles to authenticated;
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
-- 0004: Özgün başlangıç içeriği (resmî Goethe materyali değildir). Tekrar çalıştırılabilir.
insert into public.courses(id,level,title,description,position) values('a1','A1','A1 Temelleri','Selamlaşma, tanışma, artikel, sein/haben ve Präsens.',1) on conflict (id) do update set title=excluded.title,description=excluded.description;
insert into public.courses(id,level,title,description,position) values('a2','A2','A2 Gelişim','Perfekt, Dativ ve Nebensätze.',2) on conflict (id) do update set title=excluded.title,description=excluded.description;
insert into public.lessons(id,course_id,level,title,intro_tr,points,examples,position) values('a1-begruessung','a1','A1','Hallo und Begrüßung','Almanca''da selamlaşma günün saatine ve resmiyet derecesine göre değişir.','["Hallo ve Hi gayriresmîdir; Guten Tag resmî ortamlarda kullanılır.", "Sabah Guten Morgen, akşam Guten Abend denir.", "Tschüs gayriresmî, Auf Wiedersehen resmî vedalaşmadır.", "Wie geht''s? ''Nasılsın?'' demektir; kısa cevap: Danke, gut."]'::jsonb,'[{"de": "Guten Morgen, Frau Müller!", "tr": "Günaydın Bayan Müller!"}, {"de": "Wie geht es Ihnen? – Danke, gut.", "tr": "Nasılsınız? – Teşekkürler, iyi."}, {"de": "Tschüs, bis morgen!", "tr": "Hoşça kal, yarın görüşürüz!"}]'::jsonb,1) on conflict (id) do update set title=excluded.title,intro_tr=excluded.intro_tr,points=excluded.points,examples=excluded.examples;
insert into public.exercises(id,skill,level,prompt,options,answer,explanation,lesson_id) values('a1-begruessung-q1','grammatik','A1','Du triffst deinen Lehrer um 9 Uhr morgens. Was sagst du?','["Guten Morgen", "Gute Nacht", "Tschüs", "Guten Abend"]'::jsonb,'Guten Morgen','Sabah saatlerinde Guten Morgen denir.','a1-begruessung') on conflict (id) do update set prompt=excluded.prompt,options=excluded.options,answer=excluded.answer,explanation=excluded.explanation;
insert into public.exercises(id,skill,level,prompt,options,answer,explanation,lesson_id) values('a1-begruessung-q2','grammatik','A1','Welche Verabschiedung ist formell?','["Tschüs", "Auf Wiedersehen", "Hi", "Hallo"]'::jsonb,'Auf Wiedersehen','Auf Wiedersehen resmî vedalaşmadır.','a1-begruessung') on conflict (id) do update set prompt=excluded.prompt,options=excluded.options,answer=excluded.answer,explanation=excluded.explanation;
insert into public.exercises(id,skill,level,prompt,options,answer,explanation,lesson_id) values('a1-begruessung-q3','grammatik','A1','Auf „Wie geht''s?“ antwortest du:','["Danke, gut.", "Ich heiße Anna.", "Auf Wiedersehen.", "Ich bin 20."]'::jsonb,'Danke, gut.','Wie geht''s? sorusuna durum bildiren kısa cevap verilir.','a1-begruessung') on conflict (id) do update set prompt=excluded.prompt,options=excluded.options,answer=excluded.answer,explanation=excluded.explanation;
insert into public.lessons(id,course_id,level,title,intro_tr,points,examples,position) values('a1-vorstellen','a1','A1','Sich vorstellen','Kendini tanıtırken sabit kalıplar kullanılır.','["Ich heiße … veya Mein Name ist … ile isim söylenir.", "Ich komme aus … ile ülke/şehir belirtilir.", "Ich wohne in … yaşadığın yeri anlatır.", "Ich bin … Jahre alt yaşı söyler."]'::jsonb,'[{"de": "Ich heiße Ali und ich komme aus der Türkei.", "tr": "Adım Ali ve Türkiye''denim."}, {"de": "Ich wohne in Istanbul.", "tr": "İstanbul''da oturuyorum."}, {"de": "Ich bin 25 Jahre alt.", "tr": "25 yaşındayım."}]'::jsonb,2) on conflict (id) do update set title=excluded.title,intro_tr=excluded.intro_tr,points=excluded.points,examples=excluded.examples;
insert into public.exercises(id,skill,level,prompt,options,answer,explanation,lesson_id) values('a1-vorstellen-q1','grammatik','A1','Ich ___ Ali.','["heiße", "heißt", "heißen", "heißst"]'::jsonb,'heiße','ich ile fiil heiße şeklinde çekimlenir.','a1-vorstellen') on conflict (id) do update set prompt=excluded.prompt,options=excluded.options,answer=excluded.answer,explanation=excluded.explanation;
insert into public.exercises(id,skill,level,prompt,options,answer,explanation,lesson_id) values('a1-vorstellen-q2','grammatik','A1','Woher kommst du?','["Ich komme aus Izmir.", "Ich wohne gern.", "Ich bin gut.", "Ich heiße komme."]'::jsonb,'Ich komme aus Izmir.','Woher? sorusu geldiğin yeri sorar.','a1-vorstellen') on conflict (id) do update set prompt=excluded.prompt,options=excluded.options,answer=excluded.answer,explanation=excluded.explanation;
insert into public.exercises(id,skill,level,prompt,options,answer,explanation,lesson_id) values('a1-vorstellen-q3','grammatik','A1','Ich ___ 25 Jahre alt.','["bin", "habe", "heiße", "komme"]'::jsonb,'bin','Almanca''da yaş sein fiiliyle söylenir: Ich bin … Jahre alt.','a1-vorstellen') on conflict (id) do update set prompt=excluded.prompt,options=excluded.options,answer=excluded.answer,explanation=excluded.explanation;
insert into public.lessons(id,course_id,level,title,intro_tr,points,examples,position) values('a1-artikel','a1','A1','Artikel: der, die, das','Her Almanca ismin bir cinsiyeti vardır ve artikel isimle birlikte öğrenilmelidir.','["der eril, die dişil, das nötr isimlerle kullanılır.", "Çoğulda artikel her zaman die olur.", "Belirsiz artikel: ein (der/das), eine (die).", "Cinsiyet çoğu zaman mantıkla tahmin edilemez; kelimeyi artikeliyle ezberle."]'::jsonb,'[{"de": "der Tisch – die Lampe – das Buch", "tr": "masa – lamba – kitap"}, {"de": "Die Kinder spielen im Garten.", "tr": "Çocuklar bahçede oynuyor."}, {"de": "Das ist eine Lampe.", "tr": "Bu bir lamba."}]'::jsonb,3) on conflict (id) do update set title=excluded.title,intro_tr=excluded.intro_tr,points=excluded.points,examples=excluded.examples;
insert into public.exercises(id,skill,level,prompt,options,answer,explanation,lesson_id) values('a1-artikel-q1','grammatik','A1','___ Buch ist neu.','["Das", "Der", "Die", "Den"]'::jsonb,'Das','Buch nötr bir isimdir: das Buch.','a1-artikel') on conflict (id) do update set prompt=excluded.prompt,options=excluded.options,answer=excluded.answer,explanation=excluded.explanation;
insert into public.exercises(id,skill,level,prompt,options,answer,explanation,lesson_id) values('a1-artikel-q2','grammatik','A1','___ Lampe ist hell.','["Die", "Der", "Das", "Ein"]'::jsonb,'Die','Lampe dişildir: die Lampe.','a1-artikel') on conflict (id) do update set prompt=excluded.prompt,options=excluded.options,answer=excluded.answer,explanation=excluded.explanation;
insert into public.exercises(id,skill,level,prompt,options,answer,explanation,lesson_id) values('a1-artikel-q3','grammatik','A1','Im Plural benutzt man immer: ___ Kinder.','["Die", "Der", "Das", "Ein"]'::jsonb,'Die','Çoğulda artikel hep die''dir.','a1-artikel') on conflict (id) do update set prompt=excluded.prompt,options=excluded.options,answer=excluded.answer,explanation=excluded.explanation;
insert into public.lessons(id,course_id,level,title,intro_tr,points,examples,position) values('a1-sein-haben','a1','A1','Sein und haben','İki en önemli yardımcı fiil: sein (olmak) ve haben (sahip olmak).','["sein: ich bin, du bist, er/sie/es ist, wir sind, ihr seid, sie sind.", "haben: ich habe, du hast, er/sie/es hat, wir haben, ihr habt, sie haben.", "sein durum/meslek bildirir, haben sahip olmayı anlatır.", "Olumsuzluk: sein ile nicht, haben + isim ile kein kullanılır."]'::jsonb,'[{"de": "Ich bin Student.", "tr": "Ben öğrenciyim."}, {"de": "Er hat einen Bruder.", "tr": "Onun bir erkek kardeşi var."}, {"de": "Wir sind müde.", "tr": "Biz yorgunuz."}]'::jsonb,4) on conflict (id) do update set title=excluded.title,intro_tr=excluded.intro_tr,points=excluded.points,examples=excluded.examples;
insert into public.exercises(id,skill,level,prompt,options,answer,explanation,lesson_id) values('a1-sein-haben-q1','grammatik','A1','Du ___ sehr nett.','["bist", "bin", "ist", "seid"]'::jsonb,'bist','du ile sein: du bist.','a1-sein-haben') on conflict (id) do update set prompt=excluded.prompt,options=excluded.options,answer=excluded.answer,explanation=excluded.explanation;
insert into public.exercises(id,skill,level,prompt,options,answer,explanation,lesson_id) values('a1-sein-haben-q2','grammatik','A1','Sie (o) ___ zwei Kinder.','["hat", "habe", "hast", "haben"]'::jsonb,'hat','sie (tekil) ile haben: sie hat.','a1-sein-haben') on conflict (id) do update set prompt=excluded.prompt,options=excluded.options,answer=excluded.answer,explanation=excluded.explanation;
insert into public.exercises(id,skill,level,prompt,options,answer,explanation,lesson_id) values('a1-sein-haben-q3','grammatik','A1','Wir ___ Hunger.','["haben", "sind", "habt", "hat"]'::jsonb,'haben','Hunger haben kalıbı: wir haben Hunger.','a1-sein-haben') on conflict (id) do update set prompt=excluded.prompt,options=excluded.options,answer=excluded.answer,explanation=excluded.explanation;
insert into public.lessons…8507 tokens truncated…,explanation=excluded.explanation,passage=excluded.passage,audio_text=excluded.audio_text;
insert into public.exercises(id,skill,level,grp,passage,audio_text,prompt,options,answer,explanation) values('pool-31','horen','A2','hor-a2-2',null,'Hallo Mia, hier ist Paul. Ich habe leider keine Zeit am Samstag, weil ich arbeiten muss. Können wir am Sonntag ins Kino gehen? Ruf mich bitte zurück.','Warum hat Paul am Samstag keine Zeit?','["Er muss arbeiten.", "Er ist krank.", "Er fährt weg.", "Er lernt."]'::jsonb,'Er muss arbeiten.','Duyulan: weil ich arbeiten muss.') on conflict (id) do update set prompt=excluded.prompt,options=excluded.options,answer=excluded.answer,explanation=excluded.explanation,passage=excluded.passage,audio_text=excluded.audio_text;
insert into public.exercises(id,skill,level,grp,passage,audio_text,prompt,options,answer,explanation) values('pool-32','horen','A2','hor-a2-2',null,'Hallo Mia, hier ist Paul. Ich habe leider keine Zeit am Samstag, weil ich arbeiten muss. Können wir am Sonntag ins Kino gehen? Ruf mich bitte zurück.','Was möchte Paul am Sonntag machen?','["Ins Kino gehen", "Fußball spielen", "Essen gehen", "Einkaufen"]'::jsonb,'Ins Kino gehen','Duyulan: am Sonntag ins Kino gehen.') on conflict (id) do update set prompt=excluded.prompt,options=excluded.options,answer=excluded.answer,explanation=excluded.explanation,passage=excluded.passage,audio_text=excluded.audio_text;
insert into public.vocabulary(de,article,plural,tr,example_de,example_tr,level,category) values('Mutter','die','Mütter','anne','Meine Mutter kocht gern.','Annem yemek yapmayı sever.','A1','Familie') on conflict (de) do update set tr=excluded.tr,example_de=excluded.example_de,example_tr=excluded.example_tr;
insert into public.vocabulary(de,article,plural,tr,example_de,example_tr,level,category) values('Vater','der','Väter','baba','Mein Vater arbeitet heute.','Babam bugün çalışıyor.','A1','Familie') on conflict (de) do update set tr=excluded.tr,example_de=excluded.example_de,example_tr=excluded.example_tr;
insert into public.vocabulary(de,article,plural,tr,example_de,example_tr,level,category) values('Bruder','der','Brüder','erkek kardeş','Mein Bruder ist zwölf Jahre alt.','Erkek kardeşim on iki yaşında.','A1','Familie') on conflict (de) do update set tr=excluded.tr,example_de=excluded.example_de,example_tr=excluded.example_tr;
insert into public.vocabulary(de,article,plural,tr,example_de,example_tr,level,category) values('Schwester','die','Schwestern','kız kardeş','Meine Schwester wohnt in Berlin.','Kız kardeşim Berlin''de oturuyor.','A1','Familie') on conflict (de) do update set tr=excluded.tr,example_de=excluded.example_de,example_tr=excluded.example_tr;
insert into public.vocabulary(de,article,plural,tr,example_de,example_tr,level,category) values('Kind','das','Kinder','çocuk','Das Kind spielt im Garten.','Çocuk bahçede oynuyor.','A1','Familie') on conflict (de) do update set tr=excluded.tr,example_de=excluded.example_de,example_tr=excluded.example_tr;
insert into public.vocabulary(de,article,plural,tr,example_de,example_tr,level,category) values('Freund','der','Freunde','arkadaş','Er ist mein bester Freund.','O benim en iyi arkadaşım.','A1','Familie') on conflict (de) do update set tr=excluded.tr,example_de=excluded.example_de,example_tr=excluded.example_tr;
insert into public.vocabulary(de,article,plural,tr,example_de,example_tr,level,category) values('Brot','das','Brote','ekmek','Ich kaufe ein Brot.','Bir ekmek alıyorum.','A1','Essen und Trinken') on conflict (de) do update set tr=excluded.tr,example_de=excluded.example_de,example_tr=excluded.example_tr;
insert into public.vocabulary(de,article,plural,tr,example_de,example_tr,level,category) values('Wasser','das',null,'su','Ich trinke Wasser.','Su içiyorum.','A1','Essen und Trinken') on conflict (de) do update set tr=excluded.tr,example_de=excluded.example_de,example_tr=excluded.example_tr;
insert into public.vocabulary(de,article,plural,tr,example_de,example_tr,level,category) values('Apfel','der','Äpfel','elma','Der Apfel ist rot.','Elma kırmızı.','A1','Essen und Trinken') on conflict (de) do update set tr=excluded.tr,example_de=excluded.example_de,example_tr=excluded.example_tr;
insert into public.vocabulary(de,article,plural,tr,example_de,example_tr,level,category) values('Kaffee','der',null,'kahve','Ich möchte einen Kaffee.','Bir kahve istiyorum.','A1','Essen und Trinken') on conflict (de) do update set tr=excluded.tr,example_de=excluded.example_de,example_tr=excluded.example_tr;
insert into public.vocabulary(de,article,plural,tr,example_de,example_tr,level,category) values('Käse','der',null,'peynir','Der Käse schmeckt gut.','Peynir lezzetli.','A1','Essen und Trinken') on conflict (de) do update set tr=excluded.tr,example_de=excluded.example_de,example_tr=excluded.example_tr;
insert into public.vocabulary(de,article,plural,tr,example_de,example_tr,level,category) values('Milch','die',null,'süt','Die Milch ist kalt.','Süt soğuk.','A1','Essen und Trinken') on conflict (de) do update set tr=excluded.tr,example_de=excluded.example_de,example_tr=excluded.example_tr;
insert into public.vocabulary(de,article,plural,tr,example_de,example_tr,level,category) values('Frühstück','das',null,'kahvaltı','Das Frühstück ist um acht Uhr.','Kahvaltı saat sekizde.','A1','Essen und Trinken') on conflict (de) do update set tr=excluded.tr,example_de=excluded.example_de,example_tr=excluded.example_tr;
insert into public.vocabulary(de,article,plural,tr,example_de,example_tr,level,category) values('Suppe','die','Suppen','çorba','Die Suppe ist heiß.','Çorba sıcak.','A1','Essen und Trinken') on conflict (de) do update set tr=excluded.tr,example_de=excluded.example_de,example_tr=excluded.example_tr;
insert into public.vocabulary(de,article,plural,tr,example_de,example_tr,level,category) values('Haus','das','Häuser','ev','Das Haus ist groß.','Ev büyük.','A1','Wohnen') on conflict (de) do update set tr=excluded.tr,example_de=excluded.example_de,example_tr=excluded.example_tr;
insert into public.vocabulary(de,article,plural,tr,example_de,example_tr,level,category) values('Zimmer','das','Zimmer','oda','Mein Zimmer ist klein.','Odam küçük.','A1','Wohnen') on conflict (de) do update set tr=excluded.tr,example_de=excluded.example_de,example_tr=excluded.example_tr;
insert into public.vocabulary(de,article,plural,tr,example_de,example_tr,level,category) values('Küche','die','Küchen','mutfak','Die Küche ist modern.','Mutfak modern.','A1','Wohnen') on conflict (de) do update set tr=excluded.tr,example_de=excluded.example_de,example_tr=excluded.example_tr;
insert into public.vocabulary(de,article,plural,tr,example_de,example_tr,level,category) values('Tisch','der','Tische','masa','Das Buch liegt auf dem Tisch.','Kitap masanın üstünde.','A1','Wohnen') on conflict (de) do update set tr=excluded.tr,example_de=excluded.example_de,example_tr=excluded.example_tr;
insert into public.vocabulary(de,article,plural,tr,example_de,example_tr,level,category) values('Fenster','das','Fenster','pencere','Das Fenster ist offen.','Pencere açık.','A1','Wohnen') on conflict (de) do update set tr=excluded.tr,example_de=excluded.example_de,example_tr=excluded.example_tr;
insert into public.vocabulary(de,article,plural,tr,example_de,example_tr,level,category) values('Tür','die','Türen','kapı','Bitte mach die Tür zu.','Lütfen kapıyı kapat.','A1','Wohnen') on conflict (de) do update set tr=excluded.tr,example_de=excluded.example_de,example_tr=excluded.example_tr;
insert into public.vocabulary(de,article,plural,tr,example_de,example_tr,level,category) values('Straße','die','Straßen','sokak, cadde','Die Straße ist lang.','Sokak uzun.','A1','Stadt') on conflict (de) do update set tr=excluded.tr,example_de=excluded.example_de,example_tr=excluded.example_tr;
insert into public.vocabulary(de,article,plural,tr,example_de,example_tr,level,category) values('Bahnhof','der','Bahnhöfe','tren istasyonu','Wo ist der Bahnhof?','İstasyon nerede?','A1','Stadt') on conflict (de) do update set tr=excluded.tr,example_de=excluded.example_de,example_tr=excluded.example_tr;
insert into public.vocabulary(de,article,plural,tr,example_de,example_tr,level,category) values('Supermarkt','der','Supermärkte','süpermarket','Ich gehe zum Supermarkt.','Süpermarkete gidiyorum.','A1','Stadt') on conflict (de) do update set tr=excluded.tr,example_de=excluded.example_de,example_tr=excluded.example_tr;
insert into public.vocabulary(de,article,plural,tr,example_de,example_tr,level,category) values('Schule','die','Schulen','okul','Die Schule beginnt um acht Uhr.','Okul saat sekizde başlar.','A1','Stadt') on conflict (de) do update set tr=excluded.tr,example_de=excluded.example_de,example_tr=excluded.example_tr;
insert into public.vocabulary(de,article,plural,tr,example_de,example_tr,level,category) values('Arzt','der','Ärzte','doktor','Der Arzt ist freundlich.','Doktor güler yüzlü.','A1','Stadt') on conflict (de) do update set tr=excluded.tr,example_de=excluded.example_de,example_tr=excluded.example_tr;
insert into public.vocabulary(de,article,plural,tr,example_de,example_tr,level,category) values('Stadt','die','Städte','şehir','Die Stadt ist schön.','Şehir güzel.','A1','Stadt') on conflict (de) do update set tr=excluded.tr,example_de=excluded.example_de,example_tr=excluded.example_tr;
insert into public.vocabulary(de,article,plural,tr,example_de,example_tr,level,category) values('gehen',null,null,'gitmek, yürümek','Ich gehe nach Hause.','Eve gidiyorum.','A1','Verben') on conflict (de) do update set tr=excluded.tr,example_de=excluded.example_de,example_tr=excluded.example_tr;
insert into public.vocabulary(de,article,plural,tr,example_de,example_tr,level,category) values('kommen',null,null,'gelmek','Ich komme aus der Türkei.','Türkiye''denim.','A1','Verben') on conflict (de) do update set tr=excluded.tr,example_de=excluded.example_de,example_tr=excluded.example_tr;
insert into public.vocabulary(de,article,plural,tr,example_de,example_tr,level,category) values('essen',null,null,'yemek yemek','Wir essen um zwölf Uhr.','Saat on ikide yemek yiyoruz.','A1','Verben') on conflict (de) do update set tr=excluded.tr,example_de=excluded.example_de,example_tr=excluded.example_tr;
insert into public.vocabulary(de,article,plural,tr,example_de,example_tr,level,category) values('trinken',null,null,'içmek','Sie trinkt Tee.','O çay içiyor.','A1','Verben') on conflict (de) do update set tr=excluded.tr,example_de=excluded.example_de,example_tr=excluded.example_tr;
insert into public.vocabulary(de,article,plural,tr,example_de,example_tr,level,category) values('lernen',null,null,'öğrenmek','Ich lerne jeden Tag Deutsch.','Her gün Almanca öğreniyorum.','A1','Verben') on conflict (de) do update set tr=excluded.tr,example_de=excluded.example_de,example_tr=excluded.example_tr;
insert into public.vocabulary(de,article,plural,tr,example_de,example_tr,level,category) values('wohnen',null,null,'oturmak (ikamet)','Er wohnt in Ankara.','O Ankara''da oturuyor.','A1','Verben') on conflict (de) do update set tr=excluded.tr,example_de=excluded.example_de,example_tr=excluded.example_tr;
insert into public.vocabulary(de,article,plural,tr,example_de,example_tr,level,category) values('arbeiten',null,null,'çalışmak','Sie arbeitet im Krankenhaus.','O hastanede çalışıyor.','A1','Verben') on conflict (de) do update set tr=excluded.tr,example_de=excluded.example_de,example_tr=excluded.example_tr;
insert into public.vocabulary(de,article,plural,tr,example_de,example_tr,level,category) values('kaufen',null,null,'satın almak','Wir kaufen Obst.','Meyve alıyoruz.','A1','Verben') on conflict (de) do update set tr=excluded.tr,example_de=excluded.example_de,example_tr=excluded.example_tr;
insert into public.vocabulary(de,article,plural,tr,example_de,example_tr,level,category) values('sprechen',null,null,'konuşmak','Sprichst du Englisch?','İngilizce konuşuyor musun?','A1','Verben') on conflict (de) do update set tr=excluded.tr,example_de=excluded.example_de,example_tr=excluded.example_tr;
insert into public.vocabulary(de,article,plural,tr,example_de,example_tr,level,category) values('groß',null,null,'büyük, uzun boylu','Der Hund ist groß.','Köpek büyük.','A1','Adjektive') on conflict (de) do update set tr=excluded.tr,example_de=excluded.example_de,example_tr=excluded.example_tr;
insert into public.vocabulary(de,article,plural,tr,example_de,example_tr,level,category) values('klein',null,null,'küçük','Die Katze ist klein.','Kedi küçük.','A1','Adjektive') on conflict (de) do update set tr=excluded.tr,example_de=excluded.example_de,example_tr=excluded.example_tr;
insert into public.vocabulary(de,article,plural,tr,example_de,example_tr,level,category) values('teuer',null,null,'pahalı','Das Hotel ist teuer.','Otel pahalı.','A1','Adjektive') on conflict (de) do update set tr=excluded.tr,example_de=excluded.example_de,example_tr=excluded.example_tr;
insert into public.vocabulary(de,article,plural,tr,example_de,example_tr,level,category) values('Reise','die','Reisen','yolculuk','Die Reise war lang.','Yolculuk uzundu.','A2','Reisen') on conflict (de) do update set tr=excluded.tr,example_de=excluded.example_de,example_tr=excluded.example_tr;
insert into public.vocabulary(de,article,plural,tr,example_de,example_tr,level,category) values('Koffer','der','Koffer','bavul','Mein Koffer ist schwer.','Bavulum ağır.','A2','Reisen') on conflict (de) do update set tr=excluded.tr,example_de=excluded.example_de,example_tr=excluded.example_tr;
insert into public.vocabulary(de,article,plural,tr,example_de,example_tr,level,category) values('Flughafen','der','Flughäfen','havalimanı','Der Flughafen ist weit weg.','Havalimanı çok uzak.','A2','Reisen') on conflict (de) do update set tr=excluded.tr,example_de=excluded.example_de,example_tr=excluded.example_tr;
insert into public.vocabulary(de,article,plural,tr,example_de,example_tr,level,category) values('Fahrkarte','die','Fahrkarten','bilet','Ich brauche eine Fahrkarte.','Bir bilete ihtiyacım var.','A2','Reisen') on conflict (de) do update set tr=excluded.tr,example_de=excluded.example_de,example_tr=excluded.example_tr;
insert into public.vocabulary(de,article,plural,tr,example_de,example_tr,level,category) values('Urlaub','der','Urlaube','tatil','Wir machen im Sommer Urlaub.','Yazın tatil yapıyoruz.','A2','Reisen') on conflict (de) do update set tr=excluded.tr,example_de=excluded.example_de,example_tr=excluded.example_tr;
insert into public.vocabulary(de,article,plural,tr,example_de,example_tr,level,category) values('Termin','der','Termine','randevu','Ich habe morgen einen Termin.','Yarın bir randevum var.','A2','Gesundheit') on conflict (de) do update set tr=excluded.tr,example_de=excluded.example_de,example_tr=excluded.example_tr;
insert into public.vocabulary(de,article,plural,tr,example_de,example_tr,level,category) values('Medikament','das','Medikamente','ilaç','Er nimmt ein Medikament.','O bir ilaç alıyor.','A2','Gesundheit') on conflict (de) do update set tr=excluded.tr,example_de=excluded.example_de,example_tr=excluded.example_tr;
insert into public.vocabulary(de,article,plural,tr,example_de,example_tr,level,category) values('Krankenhaus','das','Krankenhäuser','hastane','Das Krankenhaus ist in der Nähe.','Hastane yakında.','A2','Gesundheit') on conflict (de) do update set tr=excluded.tr,example_de=excluded.example_de,example_tr=excluded.example_tr;
insert into public.vocabulary(de,article,plural,tr,example_de,example_tr,level,category) values('Fieber','das',null,'ateş (hastalık)','Das Kind hat Fieber.','Çocuğun ateşi var.','A2','Gesundheit') on conflict (de) do update set tr=excluded.tr,example_de=excluded.example_de,example_tr=excluded.example_tr;
insert into public.vocabulary(de,article,plural,tr,example_de,example_tr,level,category) values('Beruf','der','Berufe','meslek','Was ist dein Beruf?','Mesleğin nedir?','A2','Arbeit') on conflict (de) do update set tr=excluded.tr,example_de=excluded.example_de,example_tr=excluded.example_tr;
insert into public.vocabulary(de,article,plural,tr,example_de,example_tr,level,category) values('Kollege','der','Kollegen','iş arkadaşı','Mein Kollege hilft mir.','İş arkadaşım bana yardım ediyor.','A2','Arbeit') on conflict (de) do update set tr=excluded.tr,example_de=excluded.example_de,example_tr=excluded.example_tr;
insert into public.vocabulary(de,article,plural,tr,example_de,example_tr,level,category) values('Chef','der','Chefs','patron, şef','Der Chef ist freundlich.','Patron güler yüzlü.','A2','Arbeit') on conflict (de) do update set tr=excluded.tr,example_de=excluded.example_de,example_tr=excluded.example_tr;
insert into public.vocabulary(de,article,plural,tr,example_de,example_tr,level,category) values('Bewerbung','die','Bewerbungen','iş başvurusu','Ich schreibe eine Bewerbung.','Bir iş başvurusu yazıyorum.','A2','Arbeit') on conflict (de) do update set tr=excluded.tr,example_de=excluded.example_de,example_tr=excluded.example_tr;
insert into public.vocabulary(de,article,plural,tr,example_de,example_tr,level,category) values('Wohnung','die','Wohnungen','daire','Die Wohnung hat drei Zimmer.','Dairenin üç odası var.','A2','Wohnen') on conflict (de) do update set tr=excluded.tr,example_de=excluded.example_de,example_tr=excluded.example_tr;
insert into public.vocabulary(de,article,plural,tr,example_de,example_tr,level,category) values('Miete','die','Mieten','kira','Die Miete ist zu hoch.','Kira çok yüksek.','A2','Wohnen') on conflict (de) do update set tr=excluded.tr,example_de=excluded.example_de,example_tr=excluded.example_tr;
insert into public.vocabulary(de,article,plural,tr,example_de,example_tr,level,category) values('Nachbar','der','Nachbarn','komşu','Mein Nachbar ist nett.','Komşum nazik.','A2','Wohnen') on conflict (de) do update set tr=excluded.tr,example_de=excluded.example_de,example_tr=excluded.example_tr;
insert into public.vocabulary(de,article,plural,tr,example_de,example_tr,level,category) values('vergessen',null,null,'unutmak','Ich habe meinen Schlüssel vergessen.','Anahtarımı unuttum.','A2','Verben') on conflict (de) do update set tr=excluded.tr,example_de=excluded.example_de,example_tr=excluded.example_tr;
insert into public.vocabulary(de,article,plural,tr,example_de,example_tr,level,category) values('einladen',null,null,'davet etmek','Ich lade dich zur Party ein.','Seni partiye davet ediyorum.','A2','Verben') on conflict (de) do update set tr=excluded.tr,example_de=excluded.example_de,example_tr=excluded.example_tr;
insert into public.vocabulary(de,article,plural,tr,example_de,example_tr,level,category) values('besuchen',null,null,'ziyaret etmek','Wir besuchen unsere Oma.','Büyükannemizi ziyaret ediyoruz.','A2','Verben') on conflict (de) do update set tr=excluded.tr,example_de=excluded.example_de,example_tr=excluded.example_tr;
insert into public.vocabulary(de,article,plural,tr,example_de,example_tr,level,category) values('vorbereiten',null,null,'hazırlamak','Er bereitet das Abendessen vor.','O akşam yemeğini hazırlıyor.','A2','Verben') on conflict (de) do update set tr=excluded.tr,example_de=excluded.example_de,example_tr=excluded.example_tr;
insert into public.vocabulary(de,article,plural,tr,example_de,example_tr,level,category) values('erklären',null,null,'açıklamak','Der Lehrer erklärt die Grammatik.','Öğretmen grameri açıklıyor.','A2','Verben') on conflict (de) do update set tr=excluded.tr,example_de=excluded.example_de,example_tr=excluded.example_tr;
insert into public.vocabulary(de,article,plural,tr,example_de,example_tr,level,category) values('wichtig',null,null,'önemli','Das ist sehr wichtig.','Bu çok önemli.','A2','Adjektive') on conflict (de) do update set tr=excluded.tr,example_de=excluded.example_de,example_tr=excluded.example_tr;
insert into public.vocabulary(de,article,plural,tr,example_de,example_tr,level,category) values('müde',null,null,'yorgun','Ich bin heute sehr müde.','Bugün çok yorgunum.','A2','Adjektive') on conflict (de) do update set tr=excluded.tr,example_de=excluded.example_de,example_tr=excluded.example_tr;
insert into public.vocabulary(de,article,plural,tr,example_de,example_tr,level,category) values('gesund',null,null,'sağlıklı','Obst ist gesund.','Meyve sağlıklıdır.','A2','Adjektive') on conflict (de) do update set tr=excluded.tr,example_de=excluded.example_de,example_tr=excluded.example_tr;
insert into public.vocabulary(de,article,plural,tr,example_de,example_tr,level,category) values('pünktlich',null,null,'zamanında','Der Zug ist pünktlich.','Tren zamanında.','A2','Adjektive') on conflict (de) do update set tr=excluded.tr,example_de=excluded.example_de,example_tr=excluded.example_tr;

-- Yönetici panelinden AI sağlayıcısı ve API anahtarı tanımlamak için güvenli kayıt.
create table if not exists public.platform_ai_settings (
  id text primary key check (id = 'default'),
  provider text not null check (provider in ('gemini', 'openai')),
  model text not null,
  api_key_ciphertext text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.user_ai_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider text not null check (provider in ('gemini', 'openai')),
  model text not null,
  api_key_ciphertext text not null,
  jarvis_provider text not null default 'openai' check (jarvis_provider in ('gemini', 'openai')),
  gemini_model text,
  gemini_api_key_ciphertext text,
  openai_model text,
  openai_api_key_ciphertext text,
  updated_at timestamptz not null default now()
);
alter table public.platform_ai_settings enable row level security;
revoke all on public.platform_ai_settings from anon, authenticated;
grant all on public.platform_ai_settings to service_role;

alter table public.user_ai_settings enable row level security;
revoke all on public.user_ai_settings from anon;
grant select, insert, update, delete on public.user_ai_settings to authenticated;
drop policy if exists user_ai_settings_select_own on public.user_ai_settings;
create policy user_ai_settings_select_own on public.user_ai_settings for select to authenticated using (auth.uid() = user_id);
drop policy if exists user_ai_settings_insert_own on public.user_ai_settings;
create policy user_ai_settings_insert_own on public.user_ai_settings for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists user_ai_settings_update_own on public.user_ai_settings;
create policy user_ai_settings_update_own on public.user_ai_settings for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists user_ai_settings_delete_own on public.user_ai_settings;
create policy user_ai_settings_delete_own on public.user_ai_settings for delete to authenticated using (auth.uid() = user_id);

-- Bu kayıtlar yalnızca güvenilir sunucu endpoint'leri üzerinden oluşturulmalıdır.
drop policy if exists learning_plans_own_insert on public.learning_plans;
drop policy if exists voice_sessions_own_insert on public.voice_sessions;
drop policy if exists writing_submissions_own_insert on public.writing_submissions;

-- AI-created, personalized lessons and teacher feedback.
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

