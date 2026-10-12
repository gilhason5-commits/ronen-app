-- Protocols: PDF attachments on any node. Files live in the public
-- "protocol-files" Storage bucket; each entry is { name, url, path }.
alter table "ProtocolNode" add column if not exists attachments jsonb default '[]'::jsonb;

NOTIFY pgrst, 'reload schema';
