-- Append-only history of every KitchenShift state, so a lost or overwritten
-- clock-in/out (kitchen + ops rosters) can always be read back and restored.
-- Until now an overwrite or delete left no trace and nothing could be
-- recovered without a full-database backup restore.
--
-- Every INSERT/UPDATE logs the new values; every DELETE logs the removed
-- row. RLS is enabled with no policies: the app (anon key) can't read or
-- write it — only the trigger (security definer) and the dashboard/service
-- role can.

create table if not exists "KitchenShiftHistory" (
  id bigint generated always as identity primary key,
  shift_id uuid,
  member_id uuid,
  member_name text,
  station text,
  shift_date date,
  clock_in text,
  clock_out text,
  operation text not null,
  changed_at timestamptz not null default now()
);
create index if not exists idx_kitchenshifthistory_member_date on "KitchenShiftHistory"(member_id, shift_date, changed_at);
create index if not exists idx_kitchenshifthistory_changed_at on "KitchenShiftHistory"(changed_at);
alter table "KitchenShiftHistory" enable row level security;

create or replace function log_kitchen_shift_history() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    insert into "KitchenShiftHistory" (shift_id, member_id, member_name, station, shift_date, clock_in, clock_out, operation)
    values (old.id, old.member_id, old.member_name, old.station, old.shift_date, old.clock_in, old.clock_out, 'DELETE');
    return old;
  end if;
  insert into "KitchenShiftHistory" (shift_id, member_id, member_name, station, shift_date, clock_in, clock_out, operation)
  values (new.id, new.member_id, new.member_name, new.station, new.shift_date, new.clock_in, new.clock_out, tg_op);
  return new;
end $$;

drop trigger if exists kitchen_shift_history on "KitchenShift";
create trigger kitchen_shift_history
  after insert or update or delete on "KitchenShift"
  for each row execute function log_kitchen_shift_history();

-- Seed the history with the current state so it starts complete.
insert into "KitchenShiftHistory" (shift_id, member_id, member_name, station, shift_date, clock_in, clock_out, operation)
select id, member_id, member_name, station, shift_date, clock_in, clock_out, 'SNAPSHOT'
from "KitchenShift"
where not exists (select 1 from "KitchenShiftHistory");

NOTIFY pgrst, 'reload schema';
