-- Kitchen/cleaning staff schedule: a fixed named roster (grouped by station:
-- מטבח חם, מטבח קר, אקסטרה, דגים, קונדיטוריה, שטיפת סירים...) with free-form
-- clock-in/out per person per day, matching the weekly sheet Ronen's team
-- already keeps by hand. Replaces the per-event OPS role/count table on the
-- staffing map — kitchen shifts aren't tied to a specific event or derived
-- from the waiter-style rule formulas.

create table if not exists "KitchenRosterMember" (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  station text not null,
  default_clock_in text,
  default_clock_out text,
  is_active boolean default true,
  sort_order integer default 0,
  created_date timestamptz default now(),
  updated_date timestamptz default now()
);

create table if not exists "KitchenShift" (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references "KitchenRosterMember"(id) on delete cascade,
  member_name text,
  station text,
  shift_date date not null,
  clock_in text,
  clock_out text,
  created_date timestamptz default now(),
  updated_date timestamptz default now(),
  unique (member_id, shift_date)
);
create index if not exists idx_kitchenshift_date on "KitchenShift"(shift_date);

do $$
declare t text;
begin
  foreach t in array array['KitchenRosterMember','KitchenShift']
  loop
    execute format('drop trigger if exists set_updated_date on %I', t);
    execute format('create trigger set_updated_date before update on %I for each row execute function update_updated_date()', t);
  end loop;
end $$;

-- Seed the roster from the current paper/WhatsApp sheet.
insert into "KitchenRosterMember" (full_name, station, default_clock_in, default_clock_out, sort_order)
select * from (values
  ('קובי', 'מטבח חם', '11:00', '23:00', 1),
  ('אלרואי', 'מטבח חם', '11:00', '23:00', 2),
  ('TEE טה', 'מטבח חם', '11:00', '23:00', 3),
  ('דיויד טאבון', 'מטבח חם', '15:00', '23:00', 4),
  ('ITZIK', 'מטבח קר', '11:00', '19:00', 5),
  ('ונסי', 'מטבח קר', '10:00', '23:00', 6),
  ('NATASHA נטשה', 'מטבח קר', '11:00', '23:00', 7),
  ('סטיבן', 'אקסטרה', null, null, 8),
  ('תיאו', 'דגים', '11:00', '19:00', 9),
  ('אביטל', 'קונדיטוריה', '11:00', '16:00', 10),
  ('JOKA', 'שטיפת סירים', '13:00', '02:00', 11),
  ('MAK מאק', 'שטיפת סירים', '13:00', '02:00', 12)
) v(full_name, station, default_clock_in, default_clock_out, sort_order)
where not exists (select 1 from "KitchenRosterMember");
