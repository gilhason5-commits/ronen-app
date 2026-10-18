-- Append-only history of every ProtocolNode change — title, body text,
-- attachments, position and order, creation and deletion (including
-- children removed by cascade). Each row keeps the full row before and
-- after, plus who made the change, so any earlier version can be read back
-- and restored.
--
-- Written only by the trigger (security definer). Admins can read it; no
-- one can write or delete it from the app.

create table if not exists "ProtocolNodeHistory" (
  id bigint generated always as identity primary key,
  node_id uuid not null,
  operation text not null,
  old_row jsonb,
  new_row jsonb,
  changed_by_id uuid,
  changed_by_email text,
  changed_by_name text,
  changed_at timestamptz not null default now()
);
create index if not exists idx_protocolnodehistory_node on "ProtocolNodeHistory"(node_id, changed_at);
create index if not exists idx_protocolnodehistory_changed_at on "ProtocolNodeHistory"(changed_at);
alter table "ProtocolNodeHistory" enable row level security;

drop policy if exists "protocol history admin read" on "ProtocolNodeHistory";
create policy "protocol history admin read" on "ProtocolNodeHistory"
  for select to authenticated
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

create or replace function log_protocol_node_history() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  claims jsonb := auth.jwt();
  old_j jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  new_j jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
begin
  -- Skip saves that changed nothing but the timestamp.
  if tg_op = 'UPDATE' and (old_j - 'updated_date') = (new_j - 'updated_date') then
    return new;
  end if;
  insert into "ProtocolNodeHistory" (node_id, operation, old_row, new_row, changed_by_id, changed_by_email, changed_by_name)
  values (
    coalesce(new.id, old.id), tg_op, old_j, new_j,
    nullif(claims ->> 'sub', '')::uuid,
    claims ->> 'email',
    coalesce(claims -> 'user_metadata' ->> 'full_name', claims ->> 'email')
  );
  return coalesce(new, old);
end $$;

drop trigger if exists protocol_node_history on "ProtocolNode";
create trigger protocol_node_history
  after insert or update or delete on "ProtocolNode"
  for each row execute function log_protocol_node_history();

-- Seed the history with the current state so it starts complete.
insert into "ProtocolNodeHistory" (node_id, operation, new_row, changed_at)
select id, 'SNAPSHOT', to_jsonb(n), now()
from "ProtocolNode" n
where not exists (select 1 from "ProtocolNodeHistory");

NOTIFY pgrst, 'reload schema';
