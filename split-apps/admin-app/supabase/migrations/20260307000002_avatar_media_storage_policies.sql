insert into storage.buckets (id, name, public)
values 
  ('avatars', 'avatars', true),
  ('media', 'media', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Public can view avatars" on storage.objects;
create policy "Public can view avatars"
  on storage.objects for select
  to public
  using (bucket_id = 'avatars');

drop policy if exists "Users can upload own avatar" on storage.objects;
create policy "Users can upload own avatar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1]::uuid = auth.uid()
  );

drop policy if exists "Users can update own avatar" on storage.objects;
create policy "Users can update own avatar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1]::uuid = auth.uid()
  );

drop policy if exists "Users can delete own avatar" on storage.objects;
create policy "Users can delete own avatar"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1]::uuid = auth.uid()
  );

drop policy if exists "Public can view media" on storage.objects;
create policy "Public can view media"
  on storage.objects for select
  to public
  using (bucket_id = 'media');

drop policy if exists "Admins can upload media" on storage.objects;
create policy "Admins can upload media"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] in ('bts', 'announcements', 'music')
    and (
      exists (
        select 1 from public.user_profiles up
        where up.id = auth.uid()
        and up.role in ('admin', 'super_admin')
      )
      or coalesce(
        auth.jwt() -> 'app_metadata' ->> 'role',
        auth.jwt() -> 'user_metadata' ->> 'role'
      ) in ('admin', 'super_admin')
    )
  );

drop policy if exists "Admins can update media" on storage.objects;
create policy "Admins can update media"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] in ('bts', 'announcements', 'music')
    and (
      exists (
        select 1 from public.user_profiles up
        where up.id = auth.uid()
        and up.role in ('admin', 'super_admin')
      )
      or coalesce(
        auth.jwt() -> 'app_metadata' ->> 'role',
        auth.jwt() -> 'user_metadata' ->> 'role'
      ) in ('admin', 'super_admin')
    )
  );

drop policy if exists "Admins can delete media" on storage.objects;
create policy "Admins can delete media"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] in ('bts', 'announcements', 'music')
    and (
      exists (
        select 1 from public.user_profiles up
        where up.id = auth.uid()
        and up.role in ('admin', 'super_admin')
      )
      or coalesce(
        auth.jwt() -> 'app_metadata' ->> 'role',
        auth.jwt() -> 'user_metadata' ->> 'role'
      ) in ('admin', 'super_admin')
    )
  );
