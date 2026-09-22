-- General per-event expenses (security, transport, setup, etc.) — named
-- items picked from a reusable catalog (Dish rows under a Category whose
-- group_type = 'general'), but stored completely separately from
-- Events_Dish so they never enter the guest-count/waste-adjusted dish tree
-- or get counted as food cost.
create table if not exists "Event_GeneralExpense" (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references "Event"(id) on delete cascade,
  expense_name text not null,
  category_name text,
  amount numeric not null default 0,
  created_date timestamptz default now(),
  updated_date timestamptz default now()
);

create index if not exists event_general_expense_event_id_idx on "Event_GeneralExpense"(event_id);

alter table "Event_GeneralExpense" disable row level security;

create trigger update_Event_GeneralExpense_updated_date before update on "Event_GeneralExpense"
  for each row execute function update_updated_date();

NOTIFY pgrst, 'reload schema';
