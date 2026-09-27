-- Waiters become regular employees (TaskEmployee) in a dedicated "מלצרים"
-- department, each linked to the staffing agency that supplies them, instead
-- of living in the separate AgencyWorker pool. This gives them the same
-- employee card as everyone else (phone, pay type/rate, agreement, note) and
-- lets attendance pull their pay rate from that card.
--
-- EventShift.worker_id is repointed from AgencyWorker to TaskEmployee so
-- existing shift history (and the tips engine, which groups by worker_id)
-- carries over untouched. AgencyWorker is kept (not dropped) as a backup of
-- the old pool; nothing reads it anymore.

alter table "TaskEmployee"
  add column if not exists agency_id uuid references "StaffingAgency"(id) on delete set null,
  add column if not exists agency_name text,
  add column if not exists legacy_agency_worker_id uuid;

insert into "Department" (name, is_active)
select 'מלצרים', true
where not exists (select 1 from "Department" where name = 'מלצרים');

-- One TaskEmployee per AgencyWorker (idempotent via legacy_agency_worker_id).
insert into "TaskEmployee" (full_name, department_id, department_name, agency_id, agency_name,
                            is_active, whatsapp_enabled, legacy_agency_worker_id, created_date)
select w.full_name, d.id, d.name, w.agency_id, coalesce(a.name, w.agency_name),
       coalesce(w.is_active, true), false, w.id, w.created_date
from "AgencyWorker" w
cross join (select id, name from "Department" where name = 'מלצרים' limit 1) d
left join "StaffingAgency" a on a.id = w.agency_id
where not exists (select 1 from "TaskEmployee" e where e.legacy_agency_worker_id = w.id);

-- Repoint EventShift.worker_id: drop the FK to AgencyWorker, remap ids, add
-- an FK to TaskEmployee.
do $$
declare c text;
begin
  for c in
    select con.conname from pg_constraint con
    join pg_attribute att on att.attrelid = con.conrelid and att.attnum = any(con.conkey)
    where con.conrelid = '"EventShift"'::regclass and con.contype = 'f' and att.attname = 'worker_id'
  loop
    execute format('alter table "EventShift" drop constraint %I', c);
  end loop;
end $$;

update "EventShift" s
set worker_id = e.id
from "TaskEmployee" e
where e.legacy_agency_worker_id = s.worker_id;

-- Any shift still pointing at a non-employee id (shouldn't happen) is
-- detached rather than blocking the new FK.
update "EventShift" s set worker_id = null
where worker_id is not null and not exists (select 1 from "TaskEmployee" e where e.id = s.worker_id);

alter table "EventShift"
  add constraint "EventShift_worker_id_fkey" foreign key (worker_id) references "TaskEmployee"(id) on delete set null;

create index if not exists idx_taskemployee_agency on "TaskEmployee"(agency_id);

NOTIFY pgrst, 'reload schema';
