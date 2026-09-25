-- =============================================================================
-- Storage bucket for center photos.
-- Files are stored as "<center_id>/<file name>". Anyone can view; only the
-- center's provider or an admin can upload, replace or delete.
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('center-photos', 'center-photos', true)
on conflict (id) do nothing;

create policy "center-photos: public read" on storage.objects for select
  using (bucket_id = 'center-photos');

create policy "center-photos: owner or admin insert" on storage.objects for insert
  with check (
    bucket_id = 'center-photos'
    and (public.is_admin() or public.is_center_owner(((storage.foldername(name))[1])::uuid))
  );

create policy "center-photos: owner or admin update" on storage.objects for update
  using (
    bucket_id = 'center-photos'
    and (public.is_admin() or public.is_center_owner(((storage.foldername(name))[1])::uuid))
  );

create policy "center-photos: owner or admin delete" on storage.objects for delete
  using (
    bucket_id = 'center-photos'
    and (public.is_admin() or public.is_center_owner(((storage.foldername(name))[1])::uuid))
  );
