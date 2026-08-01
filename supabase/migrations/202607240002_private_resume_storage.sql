-- Provision the required private PDF bucket and user-folder policies.
-- Object names must follow: {auth.uid()}/{resume_id}.pdf

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resumes', 'resumes', false, 10485760, array['application/pdf'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists resumes_insert_own_folder on storage.objects;
create policy resumes_insert_own_folder on storage.objects
for insert to authenticated
with check (
  bucket_id = 'resumes'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists resumes_read_own_folder on storage.objects;
create policy resumes_read_own_folder on storage.objects
for select to authenticated
using (
  bucket_id = 'resumes'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists resumes_update_own_folder on storage.objects;
create policy resumes_update_own_folder on storage.objects
for update to authenticated
using (
  bucket_id = 'resumes'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'resumes'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists resumes_delete_own_folder on storage.objects;
create policy resumes_delete_own_folder on storage.objects
for delete to authenticated
using (
  bucket_id = 'resumes'
  and (storage.foldername(name))[1] = auth.uid()::text
);
