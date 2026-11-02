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
