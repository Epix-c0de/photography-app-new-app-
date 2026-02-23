-- Create buckets if they don't exist
-- photos-clean: Private bucket for original high-res photos
-- photos-watermarked: Public bucket for watermarked versions
-- thumbnails: Public bucket for gallery thumbnails

insert into storage.buckets (id, name, public)
values 
  ('photos-clean', 'photos-clean', false),
  ('photos-watermarked', 'photos-watermarked', true),
  ('thumbnails', 'thumbnails', true)
on conflict (id) do nothing;

-- Policies for photos-clean
drop policy if exists "Authenticated users can upload to photos-clean" on storage.objects;
create policy "Authenticated users can upload to photos-clean"
  on storage.objects for insert
  to authenticated
  with check ( bucket_id = 'photos-clean' );

drop policy if exists "Authenticated users can select from photos-clean" on storage.objects;
create policy "Authenticated users can select from photos-clean"
  on storage.objects for select
  to authenticated
  using ( bucket_id = 'photos-clean' );

drop policy if exists "Authenticated users can update photos-clean" on storage.objects;
create policy "Authenticated users can update photos-clean"
  on storage.objects for update
  to authenticated
  using ( bucket_id = 'photos-clean' );

drop policy if exists "Authenticated users can delete from photos-clean" on storage.objects;
create policy "Authenticated users can delete from photos-clean"
  on storage.objects for delete
  to authenticated
  using ( bucket_id = 'photos-clean' );

-- Policies for photos-watermarked
drop policy if exists "Public can view photos-watermarked" on storage.objects;
create policy "Public can view photos-watermarked"
  on storage.objects for select
  to public
  using ( bucket_id = 'photos-watermarked' );

drop policy if exists "Authenticated users can upload to photos-watermarked" on storage.objects;
create policy "Authenticated users can upload to photos-watermarked"
  on storage.objects for insert
  to authenticated
  with check ( bucket_id = 'photos-watermarked' );

drop policy if exists "Authenticated users can update photos-watermarked" on storage.objects;
create policy "Authenticated users can update photos-watermarked"
  on storage.objects for update
  to authenticated
  using ( bucket_id = 'photos-watermarked' );

drop policy if exists "Authenticated users can delete from photos-watermarked" on storage.objects;
create policy "Authenticated users can delete from photos-watermarked"
  on storage.objects for delete
  to authenticated
  using ( bucket_id = 'photos-watermarked' );

-- Policies for thumbnails
drop policy if exists "Public can view thumbnails" on storage.objects;
create policy "Public can view thumbnails"
  on storage.objects for select
  to public
  using ( bucket_id = 'thumbnails' );

drop policy if exists "Authenticated users can upload to thumbnails" on storage.objects;
create policy "Authenticated users can upload to thumbnails"
  on storage.objects for insert
  to authenticated
  with check ( bucket_id = 'thumbnails' );

drop policy if exists "Authenticated users can update thumbnails" on storage.objects;
create policy "Authenticated users can update thumbnails"
  on storage.objects for update
  to authenticated
  using ( bucket_id = 'thumbnails' );

drop policy if exists "Authenticated users can delete from thumbnails" on storage.objects;
create policy "Authenticated users can delete from thumbnails"
  on storage.objects for delete
  to authenticated
  using ( bucket_id = 'thumbnails' );
