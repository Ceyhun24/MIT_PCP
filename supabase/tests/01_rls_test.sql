-- Test-only: checks permissions (RLS), moderation and search on a local DB.
-- Run with: npm run db:test   (see scripts/db/test-local.sh)
-- Any failed check raises an exception and stops the run.
\set ON_ERROR_STOP on
set client_min_messages = notice;

-- ---------------------------------------------------------------------------
-- Fixtures (as superuser, RLS bypassed)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@example.test'),
  ('00000000-0000-0000-0000-0000000000b1', 'provider1@example.test'),
  ('00000000-0000-0000-0000-0000000000b2', 'provider2@example.test'),
  ('00000000-0000-0000-0000-0000000000c1', 'parent@example.test');

update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000a';

insert into public.centers (id, type, slug, name, district_id, address, location, price_min_azn, price_max_azn,
                            age_min_years, age_max_years, languages, external_id)
values
  ('10000000-0000-0000-0000-000000000001', 'kindergarten', 'gunes-bagcasi', 'Günəş bağçası',
   (select id from public.districts where slug = 'nasimi'), 'Nəsimi r., test ünvan 1',
   'SRID=4326;POINT(49.8490 40.3795)', 300, 450, 1, 6, '{az,ru}', 'test:1'),
  ('10000000-0000-0000-0000-000000000002', 'training_center', 'bilik-merkezi', 'Bilik Mərkəzi',
   (select id from public.districts where slug = 'yasamal'), 'Yasamal r., test ünvan 2',
   'SRID=4326;POINT(49.8200 40.3900)', 80, 200, null, null, '{az,en}', 'test:2'),
  ('10000000-0000-0000-0000-000000000003', 'kindergarten', 'gizli-bagca', 'Gizli bağça',
   (select id from public.districts where slug = 'nasimi'), 'test ünvan 3',
   'SRID=4326;POINT(49.8495 40.3800)', null, null, null, null, '{az}', 'test:3'),
  ('10000000-0000-0000-0000-000000000004', 'kindergarten', 'uzaq-bagca', 'Uzaq bağça',
   (select id from public.districts where slug = 'xazar'), 'Xəzər r., test ünvan 4',
   'SRID=4326;POINT(50.1500 40.4200)', 150, 200, 2, 6, '{az}', 'test:4');

update public.centers set is_hidden = true where slug = 'gizli-bagca';

insert into public.courses (center_id, name, subject, age_min_years, age_max_years, price_azn, price_period)
values ('10000000-0000-0000-0000-000000000002', 'İngilis dili (başlanğıc)', 'İngilis dili', 7, 12, 90, 'month');

insert into public.center_amenities (center_id, amenity_id)
select '10000000-0000-0000-0000-000000000001', id from public.amenities where slug in ('playground', 'meals');

insert into public.providers (id, profile_id, organization_name) values
  ('20000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b1', 'Provider One'),
  ('20000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000b2', 'Provider Two');

-- Provider 2 owns center 2 directly (fixture).
update public.centers set provider_id = '20000000-0000-0000-0000-0000000000b2' where slug = 'bilik-merkezi';

-- ---------------------------------------------------------------------------
-- Claims
-- ---------------------------------------------------------------------------
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b1';

insert into public.claims (id, center_id, provider_id, message)
values ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
        '20000000-0000-0000-0000-0000000000b1', 'Mən bu bağçanın direktoruyam');

do $$ begin
  -- Provider 1 cannot claim a center someone already owns.
  begin
    insert into public.claims (center_id, provider_id)
    values ('10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-0000000000b1');
    raise exception 'FAIL: claimed an already-owned center';
  exception when insufficient_privilege then raise notice 'PASS: cannot claim an owned center';
  end;
  -- Provider cannot approve their own claim.
  begin
    perform public.approve_claim('30000000-0000-0000-0000-000000000001');
    raise exception 'FAIL: provider approved own claim';
  exception when insufficient_privilege then raise notice 'PASS: provider cannot approve claims';
  end;
end $$;

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select public.approve_claim('30000000-0000-0000-0000-000000000001');

do $$ begin
  if (select provider_id from public.centers where slug = 'gunes-bagcasi') <> '20000000-0000-0000-0000-0000000000b1'
     or (select verification_status from public.centers where slug = 'gunes-bagcasi') <> 'verified' then
    raise exception 'FAIL: claim approval did not transfer ownership';
  end if;
  if (select role from public.profiles where id = '00000000-0000-0000-0000-0000000000b1') <> 'provider' then
    raise exception 'FAIL: claim approval did not grant provider role';
  end if;
  raise notice 'PASS: admin approval makes provider owner + listing verified';
end $$;

-- ---------------------------------------------------------------------------
-- Provider editing: own center only
-- ---------------------------------------------------------------------------
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b1';

do $$
declare n int;
begin
  update public.centers set phone = '+994 12 000 00 01' where slug = 'gunes-bagcasi';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: provider could not edit own center'; end if;
  raise notice 'PASS: provider edits own center';

  update public.centers set name = 'HACKED' where slug = 'bilik-merkezi';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: provider edited another center'; end if;
  raise notice 'PASS: RLS blocks provider editing another center (0 rows updated)';

  begin
    update public.centers set is_hidden = true where slug = 'gunes-bagcasi';
    raise exception 'FAIL: provider changed admin-only column';
  exception when insufficient_privilege then raise notice 'PASS: provider cannot change admin-only columns';
  end;

  insert into public.courses (center_id, name) values ('10000000-0000-0000-0000-000000000001', 'Rəsm dərnəyi');
  raise notice 'PASS: provider adds course to own center';

  begin
    insert into public.courses (center_id, name) values ('10000000-0000-0000-0000-000000000002', 'HACK');
    raise exception 'FAIL: provider added course to another center';
  exception when insufficient_privilege then raise notice 'PASS: RLS blocks adding course to another center';
  end;

  delete from public.courses where center_id = '10000000-0000-0000-0000-000000000002';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: provider deleted another center''s course'; end if;
  raise notice 'PASS: RLS blocks deleting another center''s courses';

  begin
    insert into public.centers (type, slug, name) values ('kindergarten', 'new-one', 'Yeni');
    raise exception 'FAIL: provider created a center';
  exception when insufficient_privilege then raise notice 'PASS: only admins create centers';
  end;

  begin
    insert into storage.objects (bucket_id, name) values ('center-photos', '10000000-0000-0000-0000-000000000002/x.jpg');
    raise exception 'FAIL: provider uploaded photo to another center';
  exception when insufficient_privilege then raise notice 'PASS: storage blocks upload to another center';
  end;
  insert into storage.objects (bucket_id, name) values ('center-photos', '10000000-0000-0000-0000-000000000001/x.jpg');
  raise notice 'PASS: provider uploads photo to own center';
end $$;

-- ---------------------------------------------------------------------------
-- Reviews + moderation
-- ---------------------------------------------------------------------------
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';

-- Tries to self-approve; the trigger must force "pending".
insert into public.reviews (id, center_id, user_id, rating, body, status)
values ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-0000000000c1', 5, 'Çox yaxşı bağçadır', 'approved');

do $$ begin
  if (select status from public.reviews where id = '40000000-0000-0000-0000-000000000001') <> 'pending' then
    raise exception 'FAIL: user self-approved a review';
  end if;
  raise notice 'PASS: new review is pending even if user asks for approved';
  begin
    insert into public.reviews (center_id, user_id, rating, body)
    values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c1', 1, 'ikinci');
    raise exception 'FAIL: second review by same user allowed';
  exception when unique_violation then raise notice 'PASS: one review per user per center';
  end;
  begin
    insert into public.reviews (center_id, user_id, rating, body)
    values ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000b1', 1, 'saxta');
    raise exception 'FAIL: review written in someone else''s name';
  exception when insufficient_privilege then raise notice 'PASS: cannot write a review as another user';
  end;
  begin
    update public.profiles set role = 'admin' where id = auth.uid();
    raise exception 'FAIL: user promoted self';
  exception when insufficient_privilege then raise notice 'PASS: user cannot change own role';
  end;
end $$;

reset request.jwt.claim.sub;
set role anon;
do $$ begin
  if exists (select 1 from public.reviews) then raise exception 'FAIL: anon sees pending review'; end if;
  raise notice 'PASS: pending review is not public';
end $$;

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b1';
do $$
declare n int;
begin
  if exists (select 1 from public.reviews) then raise exception 'FAIL: provider sees pending review'; end if;
  begin
    insert into public.review_replies (review_id, provider_id, body)
    values ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-0000000000b1', 'Təşəkkürlər');
    raise exception 'FAIL: replied to a pending review';
  exception when insufficient_privilege then raise notice 'PASS: cannot reply to unapproved review';
  end;
end $$;

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
update public.reviews set status = 'approved' where id = '40000000-0000-0000-0000-000000000001';

reset request.jwt.claim.sub;
set role anon;
do $$ begin
  if (select count(*) from public.reviews) <> 1 then raise exception 'FAIL: approved review not public'; end if;
  if (select rating_avg from public.centers where slug = 'gunes-bagcasi') <> 5
     or (select rating_count from public.centers where slug = 'gunes-bagcasi') <> 1 then
    raise exception 'FAIL: rating not updated';
  end if;
  raise notice 'PASS: review public after admin approval; average 5.00 (1 review)';
end $$;

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b1';
do $$
declare n int;
begin
  update public.reviews set body = 'dəyişdirildi', rating = 1 where id = '40000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: provider edited a review'; end if;
  delete from public.reviews where id = '40000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: provider deleted a review'; end if;
  raise notice 'PASS: provider cannot edit or delete reviews';

  insert into public.review_replies (review_id, provider_id, body)
  values ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-0000000000b1', 'Təşəkkür edirik!');
  raise notice 'PASS: owner provider replies to approved review';
end $$;

set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b2';
do $$ begin
  begin
    update public.review_replies set body = 'x';
    if exists (select 1 from public.review_replies where body = 'x') then
      raise exception 'FAIL: other provider edited reply';
    end if;
    raise notice 'PASS: other provider cannot edit the reply';
  end;
end $$;

-- Author edits approved review → goes back to pending, rating recalculated.
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
update public.reviews set body = 'Yenilənmiş rəy', rating = 4 where id = '40000000-0000-0000-0000-000000000001';
reset request.jwt.claim.sub;
set role anon;
do $$ begin
  if exists (select 1 from public.reviews) then raise exception 'FAIL: edited review stayed public'; end if;
  if (select rating_count from public.centers where slug = 'gunes-bagcasi') <> 0 then
    raise exception 'FAIL: rating not recalculated after edit';
  end if;
  raise notice 'PASS: edited review returns to moderation queue';
end $$;

-- ---------------------------------------------------------------------------
-- Search (as anonymous visitor)
-- ---------------------------------------------------------------------------
do $$
declare slugs text;
begin
  -- Hidden listing never appears.
  if exists (select 1 from public.search_centers() where slug = 'gizli-bagca') then
    raise exception 'FAIL: hidden center in search';
  end if;
  raise notice 'PASS: hidden listings excluded';

  -- Near me: origin at 28 May area; expect distance order 1 → 2 → 4.
  select string_agg(slug, ',' order by distance_m) into slugs
  from public.search_centers(p_lat => 40.3790, p_lng => 49.8485);
  if slugs <> 'gunes-bagcasi,bilik-merkezi,uzaq-bagca' then raise exception 'FAIL: distance order %', slugs; end if;
  raise notice 'PASS: near-me sorted by distance (%)', slugs;

  select string_agg(slug, ',') into slugs
  from public.search_centers(p_lat => 40.3790, p_lng => 49.8485, p_radius_km => 3);
  if slugs <> 'gunes-bagcasi,bilik-merkezi' then raise exception 'FAIL: 3 km radius %', slugs; end if;
  select string_agg(slug, ',') into slugs
  from public.search_centers(p_lat => 40.3790, p_lng => 49.8485, p_radius_km => 1);
  if slugs <> 'gunes-bagcasi' then raise exception 'FAIL: 1 km radius %', slugs; end if;
  raise notice 'PASS: radius filter (1 km → 1 result, 3 km → 2 results)';

  select string_agg(slug, ',') into slugs from public.search_centers(p_query => 'ingilis');
  if slugs <> 'bilik-merkezi' then raise exception 'FAIL: course search %', slugs; end if;
  raise notice 'PASS: text search matches course names ("ingilis" → İngilis dili)';

  select string_agg(slug, ',' order by slug) into slugs from public.search_centers(p_query => 'GUNES');
  if slugs <> 'gunes-bagcasi' then raise exception 'FAIL: folded search %', slugs; end if;
  raise notice 'PASS: search ignores Azerbaijani letters/case ("GUNES" → Günəş)';

  select string_agg(slug, ',' order by slug) into slugs from public.search_centers(p_type => 'kindergarten', p_district_slug => 'nasimi');
  if slugs <> 'gunes-bagcasi' then raise exception 'FAIL: type+district %', slugs; end if;
  raise notice 'PASS: section + district filter';

  select string_agg(slug, ',' order by slug) into slugs from public.search_centers(p_price_max => 220);
  if slugs <> 'bilik-merkezi,uzaq-bagca' then raise exception 'FAIL: price %', slugs; end if;
  raise notice 'PASS: price filter (≤ 220 ₼)';

  select string_agg(slug, ',' order by slug) into slugs from public.search_centers(p_age => 10);
  if slugs <> 'bilik-merkezi' then raise exception 'FAIL: age %', slugs; end if;
  raise notice 'PASS: age filter uses course ages (10 yaş)';

  select string_agg(slug, ',' order by slug) into slugs from public.search_centers(p_language => 'en');
  if slugs <> 'bilik-merkezi' then raise exception 'FAIL: language %', slugs; end if;
  select string_agg(slug, ',' order by slug) into slugs from public.search_centers(p_amenities => '{playground,meals}');
  if slugs <> 'gunes-bagcasi' then raise exception 'FAIL: amenities %', slugs; end if;
  if exists (select 1 from public.search_centers(p_amenities => '{playground,transport}')) then
    raise exception 'FAIL: amenities must all match';
  end if;
  raise notice 'PASS: language + amenity filters';
end $$;

reset role;
\echo ALL RLS/SEARCH TESTS PASSED
