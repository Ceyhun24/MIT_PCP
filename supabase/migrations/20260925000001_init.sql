-- =============================================================================
-- Baku kindergartens & training centers directory — initial schema
--
-- Tables: districts, profiles, providers, centers, courses, amenities,
--         center_amenities, photos, reviews, review_replies, claims
-- Security: every table has Row Level Security (RLS) enabled. Providers can
--           only modify centers they own (claimed + approved by an admin).
-- =============================================================================

create extension if not exists postgis with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type public.center_type as enum ('kindergarten', 'training_center');
create type public.user_role as enum ('user', 'provider', 'admin');
create type public.verification_status as enum ('unverified', 'verified');
create type public.moderation_status as enum ('pending', 'approved', 'rejected');
create type public.price_period as enum ('month', 'lesson', 'total');

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

-- Folds Azerbaijani letters to plain ASCII and lower-cases, so that a search
-- for "bagca" matches "Bağça" and "Nesimi" matches "Nəsimi".
create or replace function public.az_fold(input text)
returns text
language sql
immutable
parallel safe
as $$
  select lower(translate(coalesce(input, ''),
    'ƏəĞğIıİÖöÜüŞşÇç',
    'eeggiiioouusscc'))
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Districts (rayonlar) of Baku — a fixed lookup list
-- -----------------------------------------------------------------------------
create table public.districts (
  id smallint generated always as identity primary key,
  slug text not null unique,
  name text not null unique              -- Azerbaijani name, e.g. "Nəsimi"
);

insert into public.districts (slug, name) values
  ('binaqadi',   'Binəqədi'),
  ('qaradag',    'Qaradağ'),
  ('xatai',      'Xətai'),
  ('xazar',      'Xəzər'),
  ('narimanov',  'Nərimanov'),
  ('nasimi',     'Nəsimi'),
  ('nizami',     'Nizami'),
  ('pirallahi',  'Pirallahı'),
  ('sabuncu',    'Sabunçu'),
  ('sabail',     'Səbail'),
  ('suraxani',   'Suraxanı'),
  ('yasamal',    'Yasamal');

-- -----------------------------------------------------------------------------
-- Profiles: one row per signed-in user (created automatically on sign-up)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  role public.user_role not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(coalesce(new.email, ''), '@', 1))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Role checks used by RLS policies. SECURITY DEFINER so they can read
-- profiles regardless of the caller's own permissions.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  )
$$;

-- -----------------------------------------------------------------------------
-- Providers: an organisation account run by a signed-in user
-- -----------------------------------------------------------------------------
create table public.providers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles (id) on delete cascade,
  organization_name text not null,
  contact_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger providers_updated_at before update on public.providers
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Centers: kindergartens and training centers
-- -----------------------------------------------------------------------------
create table public.centers (
  id uuid primary key default gen_random_uuid(),
  type public.center_type not null,
  slug text not null unique,
  name text not null,
  description text,
  district_id smallint references public.districts (id),
  address text,
  location extensions.geography (Point, 4326),
  phone text,
  email text,
  website text,
  social_links jsonb not null default '{}'::jsonb,     -- {"instagram": "...", "facebook": "..."}
  working_hours text,                                   -- free text, e.g. "B.e.–Cümə 08:00–19:00"
  age_min_years numeric(4, 1),
  age_max_years numeric(4, 1),
  price_min_azn numeric(10, 2),                         -- per month
  price_max_azn numeric(10, 2),
  languages text[] not null default '{}',               -- language of instruction: az, ru, en, tr, ...
  group_size_max integer,

  -- Ownership & publication
  provider_id uuid references public.providers (id) on delete set null,
  verification_status public.verification_status not null default 'unverified',
  is_hidden boolean not null default false,

  -- Provenance of imported data
  external_id text unique,                              -- e.g. "osm:node/123456"
  source_url text,
  collected_at timestamptz,
  field_sources jsonb not null default '{}'::jsonb,     -- {"phone": {"source_url": "...", "collected_at": "..."}}

  -- Denormalised rating (maintained by trigger from approved reviews)
  rating_avg numeric(3, 2),
  rating_count integer not null default 0,

  search_text text generated always as (
    public.az_fold(coalesce(name, '') || ' ' || coalesce(description, '') || ' ' || coalesce(address, ''))
  ) stored,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint centers_age_range check (age_min_years is null or age_max_years is null or age_min_years <= age_max_years),
  constraint centers_price_range check (price_min_azn is null or price_max_azn is null or price_min_azn <= price_max_azn),
  constraint centers_price_positive check (coalesce(price_min_azn, 0) >= 0 and coalesce(price_max_azn, 0) >= 0)
);

create index centers_location_idx on public.centers using gist (location);
create index centers_type_idx on public.centers (type) where not is_hidden;
create index centers_district_idx on public.centers (district_id);
create index centers_provider_idx on public.centers (provider_id);
create index centers_search_trgm_idx on public.centers using gin (search_text extensions.gin_trgm_ops);
create index centers_languages_idx on public.centers using gin (languages);

create trigger centers_updated_at before update on public.centers
  for each row execute function public.set_updated_at();

-- Owner check used by RLS on centers and child tables.
create or replace function public.is_center_owner(p_center_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.centers c
    join public.providers p on p.id = c.provider_id
    where c.id = p_center_id and p.profile_id = auth.uid()
  )
$$;

-- Providers may edit their center's details but not ownership, verification,
-- visibility, provenance or rating columns. Those stay admin-only.
create or replace function public.guard_center_admin_columns()
returns trigger
language plpgsql
as $$
begin
  -- auth.uid() is null for the service role (import scripts). A trigger depth
  -- above 1 means the update comes from one of our own triggers (e.g. the
  -- rating refresh after a review changes), not directly from a user.
  if public.is_admin() or auth.uid() is null or pg_trigger_depth() > 1 then
    return new;
  end if;
  if new.provider_id is distinct from old.provider_id
     or new.verification_status is distinct from old.verification_status
     or new.is_hidden is distinct from old.is_hidden
     or new.external_id is distinct from old.external_id
     or new.slug is distinct from old.slug
     or new.type is distinct from old.type
     or new.rating_avg is distinct from old.rating_avg
     or new.rating_count is distinct from old.rating_count then
    raise exception 'Only an admin can change these fields' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger centers_guard_admin_columns before update on public.centers
  for each row execute function public.guard_center_admin_columns();

-- -----------------------------------------------------------------------------
-- Courses (for training centers)
-- -----------------------------------------------------------------------------
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers (id) on delete cascade,
  name text not null,
  subject text,
  level text,                         -- e.g. "Başlanğıc", "B1", "5–7 yaş"
  age_min_years numeric(4, 1),
  age_max_years numeric(4, 1),
  duration text,                      -- e.g. "3 ay", "24 dərs"
  price_azn numeric(10, 2),
  price_period public.price_period,
  source_url text,
  collected_at timestamptz,
  search_text text generated always as (
    public.az_fold(coalesce(name, '') || ' ' || coalesce(subject, '') || ' ' || coalesce(level, ''))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint courses_age_range check (age_min_years is null or age_max_years is null or age_min_years <= age_max_years),
  constraint courses_price_positive check (price_azn is null or price_azn >= 0)
);

create index courses_center_idx on public.courses (center_id);
create index courses_search_trgm_idx on public.courses using gin (search_text extensions.gin_trgm_ops);

create trigger courses_updated_at before update on public.courses
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Amenities (environment & infrastructure). Labels live in the locale file
-- under "amenities.<slug>", so only the slug is stored here.
-- -----------------------------------------------------------------------------
create table public.amenities (
  id smallint generated always as identity primary key,
  slug text not null unique,
  sort_order smallint not null default 0
);

insert into public.amenities (slug, sort_order) values
  ('playground', 10),
  ('security_cameras', 20),
  ('meals', 30),
  ('transport', 40),
  ('medical_staff', 50),
  ('sports_hall', 60),
  ('swimming_pool', 70),
  ('garden', 80),
  ('parking', 90);

create table public.center_amenities (
  center_id uuid not null references public.centers (id) on delete cascade,
  amenity_id smallint not null references public.amenities (id) on delete cascade,
  source_url text,
  collected_at timestamptz,
  primary key (center_id, amenity_id)
);

create index center_amenities_amenity_idx on public.center_amenities (amenity_id);

-- -----------------------------------------------------------------------------
-- Photos (files live in Supabase Storage bucket "center-photos")
-- -----------------------------------------------------------------------------
create table public.photos (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers (id) on delete cascade,
  storage_path text not null,         -- "<center_id>/<file name>"
  caption text,
  sort_order integer not null default 0,
  uploaded_by uuid references public.profiles (id) on delete set null,
  source_url text,
  collected_at timestamptz,
  created_at timestamptz not null default now()
);

create index photos_center_idx on public.photos (center_id, sort_order);

-- -----------------------------------------------------------------------------
-- Reviews: 1–5 stars + text, one per user per center, visible after approval
-- -----------------------------------------------------------------------------
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  body text not null check (char_length(body) between 1 and 4000),
  status public.moderation_status not null default 'pending',
  moderated_by uuid references public.profiles (id) on delete set null,
  moderated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (center_id, user_id)
);

create index reviews_center_status_idx on public.reviews (center_id, status);
create index reviews_status_idx on public.reviews (status, created_at);

create trigger reviews_updated_at before update on public.reviews
  for each row execute function public.set_updated_at();

-- Non-admins can never set a status other than "pending"; if an author edits
-- their review it goes back into the moderation queue.
create or replace function public.guard_review_moderation()
returns trigger
language plpgsql
as $$
begin
  if public.is_admin() or auth.uid() is null then
    if tg_op = 'UPDATE' and new.status is distinct from old.status then
      new.moderated_by = auth.uid();
      new.moderated_at = now();
    end if;
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if new.center_id is distinct from old.center_id or new.user_id is distinct from old.user_id then
      raise exception 'Cannot move a review' using errcode = '42501';
    end if;
  end if;
  new.status = 'pending';
  new.moderated_by = null;
  new.moderated_at = null;
  return new;
end;
$$;

create trigger reviews_guard_moderation before insert or update on public.reviews
  for each row execute function public.guard_review_moderation();

-- Keeps centers.rating_avg / rating_count in sync with approved reviews.
create or replace function public.refresh_center_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid;
begin
  for target in
    select distinct x from unnest(array[
      case when tg_op in ('INSERT', 'UPDATE') then new.center_id end,
      case when tg_op in ('UPDATE', 'DELETE') then old.center_id end
    ]) as x where x is not null
  loop
    update public.centers c
    set rating_avg = s.avg_rating,
        rating_count = s.cnt
    from (
      select round(avg(rating)::numeric, 2) as avg_rating, count(*)::int as cnt
      from public.reviews
      where center_id = target and status = 'approved'
    ) s
    where c.id = target;
  end loop;
  return null;
end;
$$;

create trigger reviews_refresh_rating after insert or update or delete on public.reviews
  for each row execute function public.refresh_center_rating();

-- -----------------------------------------------------------------------------
-- Review replies: the center's provider may reply (one reply per review)
-- -----------------------------------------------------------------------------
create table public.review_replies (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null unique references public.reviews (id) on delete cascade,
  provider_id uuid not null references public.providers (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger review_replies_updated_at before update on public.review_replies
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Claims: a provider asks to take ownership of a listing; an admin decides
-- -----------------------------------------------------------------------------
create table public.claims (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers (id) on delete cascade,
  provider_id uuid not null references public.providers (id) on delete cascade,
  message text,                       -- e.g. role at the center, how to verify
  status public.moderation_status not null default 'pending',
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Only one open claim per provider per center.
create unique index claims_one_pending_idx on public.claims (center_id, provider_id) where status = 'pending';

-- Admin-only: approve a claim → provider becomes owner, listing becomes verified.
create or replace function public.approve_claim(p_claim_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can approve claims' using errcode = '42501';
  end if;

  select * into c from public.claims where id = p_claim_id and status = 'pending' for update;
  if not found then
    raise exception 'Claim not found or already decided';
  end if;

  update public.claims
  set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_claim_id;

  -- Reject any other pending claims for the same center.
  update public.claims
  set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now()
  where center_id = c.center_id and status = 'pending' and id <> p_claim_id;

  update public.centers
  set provider_id = c.provider_id, verification_status = 'verified'
  where id = c.center_id;

  update public.profiles p
  set role = 'provider'
  from public.providers pr
  where pr.id = c.provider_id and p.id = pr.profile_id and p.role = 'user';
end;
$$;

create or replace function public.reject_claim(p_claim_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can reject claims' using errcode = '42501';
  end if;
  update public.claims
  set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_claim_id and status = 'pending';
end;
$$;

-- Users cannot promote themselves; only admins change roles.
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Only an admin can change roles' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_role before update on public.profiles
  for each row execute function public.guard_profile_role();

-- -----------------------------------------------------------------------------
-- Search: text + filters + "near me" in one call (RLS applies: invoker rights)
-- -----------------------------------------------------------------------------
create or replace function public.search_centers(
  p_query text default null,
  p_type public.center_type default null,
  p_district_slug text default null,
  p_price_min numeric default null,
  p_price_max numeric default null,
  p_age numeric default null,
  p_language text default null,
  p_amenities text[] default null,        -- every listed amenity must be present
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_km double precision default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  type public.center_type,
  slug text,
  name text,
  district_name text,
  address text,
  lat double precision,
  lng double precision,
  price_min_azn numeric,
  price_max_azn numeric,
  age_min_years numeric,
  age_max_years numeric,
  languages text[],
  rating_avg numeric,
  rating_count integer,
  verification_status public.verification_status,
  distance_m double precision,
  total_count bigint
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with params as (
    select
      nullif(public.az_fold(trim(p_query)), '') as q,
      case when p_lat is not null and p_lng is not null
        then extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography
      end as origin
  ),
  matched as (
    select
      c.*,
      d.name as district_name,
      case when params.origin is not null and c.location is not null
        then extensions.st_distance(c.location, params.origin)
      end as distance_m
    from public.centers c
    cross join params
    left join public.districts d on d.id = c.district_id
    where not c.is_hidden
      and (p_type is null or c.type = p_type)
      and (p_district_slug is null or d.slug = p_district_slug)
      and (params.q is null
           or c.search_text like '%' || params.q || '%'
           or exists (select 1 from public.courses co
                      where co.center_id = c.id and co.search_text like '%' || params.q || '%'))
      -- price ranges overlap (listings without prices are excluded when filtering by price)
      and (p_price_min is null or coalesce(c.price_max_azn, c.price_min_azn) >= p_price_min)
      and (p_price_max is null or coalesce(c.price_min_azn, c.price_max_azn) <= p_price_max)
      and (p_age is null
           or (c.age_min_years is not null and c.age_min_years <= p_age and coalesce(c.age_max_years, 99) >= p_age)
           or (c.age_min_years is null and c.age_max_years is not null and c.age_max_years >= p_age)
           or exists (select 1 from public.courses co
                      where co.center_id = c.id
                        and coalesce(co.age_min_years, 0) <= p_age
                        and coalesce(co.age_max_years, 99) >= p_age
                        and (co.age_min_years is not null or co.age_max_years is not null)))
      and (p_language is null or p_language = any (c.languages))
      and (p_amenities is null or cardinality(p_amenities) = 0 or (
            select count(distinct a.slug) from public.center_amenities ca
            join public.amenities a on a.id = ca.amenity_id
            where ca.center_id = c.id and a.slug = any (p_amenities)
          ) = cardinality(p_amenities))
      and (params.origin is null or p_radius_km is null
           or (c.location is not null and extensions.st_dwithin(c.location, params.origin, p_radius_km * 1000)))
  )
  select
    m.id, m.type, m.slug, m.name, m.district_name, m.address,
    extensions.st_y(m.location::extensions.geometry) as lat,
    extensions.st_x(m.location::extensions.geometry) as lng,
    m.price_min_azn, m.price_max_azn, m.age_min_years, m.age_max_years,
    m.languages, m.rating_avg, m.rating_count, m.verification_status,
    m.distance_m,
    count(*) over () as total_count
  from matched m
  order by m.distance_m asc nulls last, m.rating_avg desc nulls last, m.name asc
  limit greatest(1, least(p_limit, 200)) offset greatest(0, p_offset)
$$;

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.districts enable row level security;
alter table public.profiles enable row level security;
alter table public.providers enable row level security;
alter table public.centers enable row level security;
alter table public.courses enable row level security;
alter table public.amenities enable row level security;
alter table public.center_amenities enable row level security;
alter table public.photos enable row level security;
alter table public.reviews enable row level security;
alter table public.review_replies enable row level security;
alter table public.claims enable row level security;

-- Lookup tables: readable by everyone, writable by admins.
create policy "districts: public read" on public.districts for select using (true);
create policy "districts: admin write" on public.districts for all using (public.is_admin()) with check (public.is_admin());
create policy "amenities: public read" on public.amenities for select using (true);
create policy "amenities: admin write" on public.amenities for all using (public.is_admin()) with check (public.is_admin());

-- Profiles: display names are public (shown next to reviews); users edit their own.
create policy "profiles: public read" on public.profiles for select using (true);
create policy "profiles: self update" on public.profiles for update
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- Providers: owner and admins.
create policy "providers: read own or admin" on public.providers for select
  using (profile_id = auth.uid() or public.is_admin());
create policy "providers: create own" on public.providers for insert
  with check (profile_id = auth.uid());
create policy "providers: update own or admin" on public.providers for update
  using (profile_id = auth.uid() or public.is_admin())
  with check (profile_id = auth.uid() or public.is_admin());
create policy "providers: admin delete" on public.providers for delete using (public.is_admin());

-- Centers: visible unless hidden; owners and admins can edit.
create policy "centers: public read" on public.centers for select
  using (not is_hidden or public.is_admin() or public.is_center_owner(id));
create policy "centers: admin insert" on public.centers for insert with check (public.is_admin());
create policy "centers: owner or admin update" on public.centers for update
  using (public.is_admin() or public.is_center_owner(id))
  with check (public.is_admin() or public.is_center_owner(id));
create policy "centers: admin delete" on public.centers for delete using (public.is_admin());

-- Child tables of centers share one rule: read if the center is visible,
-- write if you own the center or are an admin.
create policy "courses: read" on public.courses for select
  using (exists (select 1 from public.centers c where c.id = center_id));
create policy "courses: owner or admin write" on public.courses for all
  using (public.is_admin() or public.is_center_owner(center_id))
  with check (public.is_admin() or public.is_center_owner(center_id));

create policy "center_amenities: read" on public.center_amenities for select
  using (exists (select 1 from public.centers c where c.id = center_id));
create policy "center_amenities: owner or admin write" on public.center_amenities for all
  using (public.is_admin() or public.is_center_owner(center_id))
  with check (public.is_admin() or public.is_center_owner(center_id));

create policy "photos: read" on public.photos for select
  using (exists (select 1 from public.centers c where c.id = center_id));
create policy "photos: owner or admin write" on public.photos for all
  using (public.is_admin() or public.is_center_owner(center_id))
  with check (public.is_admin() or public.is_center_owner(center_id));

-- Reviews: approved ones are public; authors see their own; admins see all.
-- Providers can neither edit nor delete reviews.
create policy "reviews: read approved, own, or admin" on public.reviews for select
  using (status = 'approved' or user_id = auth.uid() or public.is_admin());
create policy "reviews: signed-in users create own" on public.reviews for insert
  with check (auth.uid() is not null and user_id = auth.uid());
create policy "reviews: author or admin update" on public.reviews for update
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());
create policy "reviews: author or admin delete" on public.reviews for delete
  using (user_id = auth.uid() or public.is_admin());

-- Review replies: public when the review is public; written by the center's provider.
create policy "review_replies: read" on public.review_replies for select
  using (exists (select 1 from public.reviews r where r.id = review_id));
create policy "review_replies: center owner insert" on public.review_replies for insert
  with check (
    exists (
      select 1 from public.reviews r
      join public.providers p on p.id = provider_id
      where r.id = review_id
        and r.status = 'approved'
        and p.profile_id = auth.uid()
        and public.is_center_owner(r.center_id)
    )
  );
create policy "review_replies: author update" on public.review_replies for update
  using (exists (select 1 from public.providers p where p.id = provider_id and p.profile_id = auth.uid()))
  with check (
    exists (
      select 1 from public.reviews r
      join public.providers p on p.id = provider_id
      where r.id = review_id and p.profile_id = auth.uid() and public.is_center_owner(r.center_id)
    )
  );
create policy "review_replies: author or admin delete" on public.review_replies for delete
  using (public.is_admin() or exists (select 1 from public.providers p where p.id = provider_id and p.profile_id = auth.uid()));

-- Claims: providers create and see their own; admins decide via approve_claim/reject_claim.
create policy "claims: read own or admin" on public.claims for select
  using (public.is_admin() or exists (select 1 from public.providers p where p.id = provider_id and p.profile_id = auth.uid()));
create policy "claims: provider create own" on public.claims for insert
  with check (
    status = 'pending'
    and exists (select 1 from public.providers p where p.id = provider_id and p.profile_id = auth.uid())
    and not exists (select 1 from public.centers c where c.id = center_id and c.provider_id is not null)
  );
create policy "claims: admin update" on public.claims for update
  using (public.is_admin()) with check (public.is_admin());
create policy "claims: admin delete" on public.claims for delete using (public.is_admin());

-- Function permissions
revoke execute on function public.approve_claim(uuid) from public, anon;
revoke execute on function public.reject_claim(uuid) from public, anon;
grant execute on function public.approve_claim(uuid) to authenticated;
grant execute on function public.reject_claim(uuid) to authenticated;
grant execute on function public.search_centers to anon, authenticated;
