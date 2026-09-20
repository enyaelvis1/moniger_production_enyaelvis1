insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-images',
  'profile-images',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Profile images are publicly readable" on storage.objects;
create policy "Profile images are publicly readable"
on storage.objects
for select
using (bucket_id = 'profile-images');

drop policy if exists "Users can upload their own profile images" on storage.objects;
create policy "Users can upload their own profile images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'profile-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "Users can update their own profile images" on storage.objects;
create policy "Users can update their own profile images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'profile-images'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'profile-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "Users can delete their own profile images" on storage.objects;
create policy "Users can delete their own profile images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'profile-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);
