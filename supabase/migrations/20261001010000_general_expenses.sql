-- Event-dependent general expenses for the monthly P&L, replacing the
-- per-event "כלליות" entered inside each event form. Each item is a pre-VAT
-- amount that is either per event (e.g. electricity — the same whatever the
-- headcount) or per guest (e.g. napkins, toilet paper); a month's total is
-- amount × that month's approved/completed events or their total guests.
-- These never touch an event's food cost — they only enter the monthly
-- balance, between food cost and fixed expenses.
create table if not exists "GeneralExpense" (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  amount numeric not null default 0,
  basis text not null check (basis in ('per_event', 'per_guest')),
  notes text,
  sort_order integer default 0,
  created_date timestamptz default now(),
  updated_date timestamptz default now()
);

alter table "GeneralExpense" disable row level security;

create trigger update_GeneralExpense_updated_date before update on "GeneralExpense"
  for each row execute function update_updated_date();

NOTIFY pgrst, 'reload schema';
