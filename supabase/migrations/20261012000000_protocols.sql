-- Protocols page: a modular knowledge base. Every row is a node in one tree
-- — top-level nodes are knowledge bases, their children sub-categories (any
-- depth), and any node may carry body text. Admin-managed titles and order.
create table if not exists "ProtocolNode" (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references "ProtocolNode"(id) on delete cascade,
  title text not null,
  content text,
  sort_order integer default 0,
  created_date timestamptz default now(),
  updated_date timestamptz default now()
);

create index if not exists "ProtocolNode_parent_idx" on "ProtocolNode"(parent_id);

alter table "ProtocolNode" disable row level security;

create trigger update_ProtocolNode_updated_date before update on "ProtocolNode"
  for each row execute function update_updated_date();

NOTIFY pgrst, 'reload schema';
