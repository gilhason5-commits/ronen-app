-- Recurring fixed/overhead expenses (rent, salaries, insurance, etc.), used
-- on the Reports page to compute a break-even revenue-per-event figure:
-- sum of active expenses for a month, divided by how many events happened
-- that month.
create table if not exists "FixedExpense" (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  amount numeric not null default 0,
  is_active boolean not null default true,
  sort_order integer default 0,
  created_date timestamptz default now(),
  updated_date timestamptz default now()
);

alter table "FixedExpense" disable row level security;

create trigger update_FixedExpense_updated_date before update on "FixedExpense"
  for each row execute function update_updated_date();

NOTIFY pgrst, 'reload schema';
