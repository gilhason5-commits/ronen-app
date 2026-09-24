-- Free-text label for a day that has no event, shown (and editable) in the
-- "שם האירוע" row of the kitchen/cleaning and ops monthly tables. One label
-- per date per table ('kitchen' | 'ops'). Days that do have an event keep
-- showing the event's own name, so this never overrides real event data.
create table if not exists "KitchenDayNote" (
  id uuid primary key default gen_random_uuid(),
  shift_date date not null,
  roster_group text not null default 'kitchen',
  label text not null default '',
  created_date timestamptz default now(),
  updated_date timestamptz default now(),
  unique (shift_date, roster_group)
);
create index if not exists idx_kitchendaynote_date on "KitchenDayNote"(shift_date);

drop trigger if exists set_updated_date on "KitchenDayNote";
create trigger set_updated_date before update on "KitchenDayNote"
  for each row execute function update_updated_date();

NOTIFY pgrst, 'reload schema';
