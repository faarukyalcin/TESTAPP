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
