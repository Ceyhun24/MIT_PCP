-- Approved change (Phase 3): a new profile no longer copies the part of the
-- e-mail before "@" into the public display name. The name starts empty and
-- the person types the name shown next to their reviews.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Remove e-mail-derived names created by the old version.
update public.profiles p
set display_name = null
from auth.users u
where u.id = p.id and p.display_name = split_part(coalesce(u.email, ''), '@', 1);

alter table public.profiles
  add constraint profiles_display_name_length
  check (display_name is null or char_length(btrim(display_name)) between 2 and 60);
