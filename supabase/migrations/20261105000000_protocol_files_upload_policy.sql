-- Protocol PDF uploads fail in prod with "new row violates row-level security
-- policy" for admin users. Recreate the admin insert policy idempotently.
drop policy if exists "protocol-files admin upload" on storage.objects;

create policy "protocol-files admin upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'protocol-files' and (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');
