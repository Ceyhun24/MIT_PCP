-- Test-only: FAKE listings for local development and UI testing.
-- Every name starts with "TEST" — these are not real businesses and must never
-- be imported into the real database.
insert into public.centers (type, slug, name, description, district_id, address, location, phone, website,
  social_links, working_hours, age_min_years, age_max_years, price_min_azn, price_max_azn, languages,
  group_size_max, external_id, source_url, collected_at)
select v.type::public.center_type, v.slug, v.name, v.descr, d.id, v.address,
  extensions.st_setsrid(extensions.st_makepoint(v.lng, v.lat), 4326)::extensions.geography,
  v.phone, v.website, v.social::jsonb, v.hours, v.amin, v.amax, v.pmin, v.pmax, v.langs, v.grp,
  'test:' || v.slug, 'https://example.test/' || v.slug, now()
from (values
  ('kindergarten', 'test-bagca-1', 'TEST Bağça 1', 'Test üçün uydurulmuş bağça.', 'nasimi', 'TEST ünvan, Nəsimi', 40.3790, 49.8480, '+994 12 000 00 01', 'https://example.test/1', '{"instagram":"https://instagram.com/test_1"}', 'B.e.–Cümə 08:00–19:00', 1.5, 6, 350, 500, '{az,ru}'::text[], 20),
  ('kindergarten', 'test-bagca-2', 'TEST Bağça 2', null, 'yasamal', 'TEST ünvan, Yasamal', 40.3920, 49.8150, '+994 12 000 00 02', null, '{}', null, 2, 6, 200, 300, '{az}', 25),
  ('kindergarten', 'test-bagca-3', 'TEST Bağça 3', null, 'narimanov', 'TEST ünvan, Nərimanov', 40.4030, 49.8700, null, null, '{}', 'B.e.–Şənbə 07:30–20:00', 3, 6, null, null, '{ru,en}', null),
  ('kindergarten', 'test-bagca-4', 'TEST Bağça 4', null, 'xatai', 'TEST ünvan, Xətai', 40.3830, 49.9300, '+994 12 000 00 04', null, '{}', null, 1, 5, 450, 700, '{az,en}', 15),
  ('kindergarten', 'test-bagca-5', 'TEST Bağça 5', null, 'xazar', 'TEST ünvan, Xəzər', 40.4280, 50.1500, null, null, '{}', null, null, null, 150, 150, '{az}', null),
  ('kindergarten', 'test-bagca-6', 'TEST Bağça 6', null, 'sabail', 'TEST ünvan, Səbail', 40.3660, 49.8350, '+994 12 000 00 06', 'https://example.test/6', '{}', 'B.e.–Cümə 08:00–18:00', 2, 6, 600, 900, '{en,ru}', 12),
  ('training_center', 'test-kurs-1', 'TEST Kurs Mərkəzi 1', 'Test üçün uydurulmuş tədris mərkəzi.', 'nasimi', 'TEST ünvan, Nəsimi', 40.3805, 49.8520, '+994 12 000 01 01', 'https://example.test/k1', '{"facebook":"https://facebook.com/test_k1"}', 'Hər gün 10:00–21:00', 6, 17, 80, 200, '{az,en}', 10),
  ('training_center', 'test-kurs-2', 'TEST Kurs Mərkəzi 2', null, 'yasamal', 'TEST ünvan, Yasamal', 40.3950, 49.8100, null, null, '{}', null, null, null, 60, 120, '{az,ru}', 8),
  ('training_center', 'test-kurs-3', 'TEST Kurs Mərkəzi 3', null, 'narimanov', 'TEST ünvan, Nərimanov', 40.4100, 49.8800, '+994 12 000 01 03', null, '{}', null, 14, 40, 150, 300, '{en}', 12),
  ('training_center', 'test-kurs-4', 'TEST Kurs Mərkəzi 4', null, 'binaqadi', 'TEST ünvan, Binəqədi', 40.4600, 49.8300, null, null, '{}', null, null, null, null, null, '{az}', null),
  ('training_center', 'test-kurs-5', 'TEST Kurs Mərkəzi 5', null, 'nizami', 'TEST ünvan, Nizami', 40.4000, 49.9500, '+994 12 000 01 05', null, '{}', 'B.e.–Cümə 09:00–20:00', 4, 12, 100, 180, '{az,ru}', 10),
  ('training_center', 'test-kurs-6', 'TEST Kurs Mərkəzi 6', null, 'sabuncu', 'TEST ünvan, Sabunçu', 40.4450, 49.9500, null, null, '{}', null, null, null, 50, 90, '{az}', 15)
) as v(type, slug, name, descr, district, address, lat, lng, phone, website, social, hours, amin, amax, pmin, pmax, langs, grp)
join public.districts d on d.slug = v.district;

update public.centers set verification_status = 'verified' where slug in ('test-bagca-1', 'test-kurs-1');
update public.centers set rating_avg = 4.5, rating_count = 2 where slug = 'test-bagca-1';

insert into public.center_amenities (center_id, amenity_id)
select c.id, a.id from public.centers c join public.amenities a on
  (c.slug = 'test-bagca-1' and a.slug in ('playground', 'security_cameras', 'meals', 'medical_staff'))
  or (c.slug = 'test-bagca-2' and a.slug in ('playground', 'meals'))
  or (c.slug = 'test-bagca-4' and a.slug in ('security_cameras', 'meals', 'transport', 'swimming_pool'))
  or (c.slug = 'test-bagca-6' and a.slug in ('playground', 'security_cameras', 'meals', 'transport', 'garden', 'parking'))
  or (c.slug = 'test-kurs-1' and a.slug in ('security_cameras', 'parking'));

insert into public.courses (center_id, name, subject, level, age_min_years, age_max_years, duration, price_azn, price_period)
select c.id, v.name, v.subject, v.level, v.amin, v.amax, v.duration, v.price, v.period::public.price_period
from (values
  ('test-kurs-1', 'İngilis dili (başlanğıc)', 'İngilis dili', 'A1', 7, 12, '3 ay', 90, 'month'),
  ('test-kurs-1', 'Riyaziyyat hazırlığı', 'Riyaziyyat', 'Buraxılış', 15, 17, '9 ay', 150, 'month'),
  ('test-kurs-2', 'Rus dili', 'Rus dili', 'Orta', null, null, '4 ay', 60, 'month'),
  ('test-kurs-3', 'IELTS hazırlığı', 'İngilis dili', 'B2', 16, null, '2 ay', 300, 'total'),
  ('test-kurs-5', 'Rəsm dərnəyi', 'Rəsm', null, 4, 10, null, 15, 'lesson'),
  ('test-kurs-5', 'Şahmat', 'Şahmat', 'Başlanğıc', 6, 12, '6 ay', null, null),
  ('test-kurs-6', 'Proqramlaşdırma', 'İnformatika', null, 10, 16, '5 ay', 90, 'month')
) as v(slug, name, subject, level, amin, amax, duration, price, period)
join public.centers c on c.slug = v.slug;
