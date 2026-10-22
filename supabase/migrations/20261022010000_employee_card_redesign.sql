-- Employee card (כרטיס עובד) redesign: employment terms, employer cost by
-- day, signed agreement / procedures, and a change history.

-- pay_type gains 'monthly' (חודשי). 'global' stays the per-day / per-event
-- rate (יומי) that attendance seeds shifts from; a monthly salary is not
-- seeded into shifts. The amount for monthly lives in global_rate too.
alter table "TaskEmployee" drop constraint if exists "TaskEmployee_pay_type_check";
alter table "TaskEmployee"
  add constraint "TaskEmployee_pay_type_check" check (pay_type in ('hourly', 'global', 'both', 'monthly'));

alter table "TaskEmployee"
  add column if not exists overtime_pay text,          -- 'included' | 'paid'
  add column if not exists recuperation_pay text,      -- הבראה: 'included' | 'paid'
  add column if not exists vacation_pay text,          -- חופש: 'included' | 'paid'
  add column if not exists travel_pay text,            -- 'included' | 'paid' (amount in travel_amount)
  add column if not exists employer_cost_daily numeric,
  add column if not exists via_staffing_company boolean not null default false,
  add column if not exists agreement_signed boolean not null default false,
  add column if not exists agreement_notes text,
  add column if not exists procedures_signed boolean not null default false,
  add column if not exists procedures_notes text;

-- Append-only history of every TaskEmployee change, same shape as
-- ProtocolNodeHistory. Written only by the trigger; admins can read it.
create table if not exists "TaskEmployeeHistory" (
  id bigint generated always as identity primary key,
  employee_id uuid not null,
  operation text not null,
  old_row jsonb,
  new_row jsonb,
  changed_by_id uuid,
  changed_by_email text,
  changed_by_name text,
  changed_at timestamptz not null default now()
);
create index if not exists idx_taskemployeehistory_employee on "TaskEmployeeHistory"(employee_id, changed_at);
alter table "TaskEmployeeHistory" enable row level security;

drop policy if exists "employee history admin read" on "TaskEmployeeHistory";
create policy "employee history admin read" on "TaskEmployeeHistory"
  for select to authenticated
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

create or replace function log_task_employee_history() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  claims jsonb := auth.jwt();
  old_j jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  new_j jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
begin
  if tg_op = 'UPDATE' and (old_j - 'updated_date') = (new_j - 'updated_date') then
    return new;
  end if;
  insert into "TaskEmployeeHistory" (employee_id, operation, old_row, new_row, changed_by_id, changed_by_email, changed_by_name)
  values (
    coalesce(new.id, old.id), tg_op, old_j, new_j,
    nullif(claims ->> 'sub', '')::uuid,
    claims ->> 'email',
    coalesce(claims -> 'user_metadata' ->> 'full_name', claims ->> 'email')
  );
  return coalesce(new, old);
end $$;

drop trigger if exists task_employee_history on "TaskEmployee";
create trigger task_employee_history
  after insert or update or delete on "TaskEmployee"
  for each row execute function log_task_employee_history();

NOTIFY pgrst, 'reload schema';
