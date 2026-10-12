-- Protocols: PDF attachments on any node. Files live in the public
-- "protocol-files" Storage bucket; each entry is { name, url, path }.
alter table "ProtocolNode" add column if not exists attachments jsonb default '[]'::jsonb;

NOTIFY pgrst, 'reload schema';

-- Admins upload PDFs from the browser into the public protocol-files bucket.
create policy "protocol-files admin upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'protocol-files' and (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');
