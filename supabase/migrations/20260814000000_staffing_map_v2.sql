-- Follow-up tweaks to the staffing map: rename the ריי waiter source to
-- קירה (site-wide, since agency.name is read dynamically everywhere), rename
-- the מזנונים role to מנהל מזונונים (and keep existing plan assignments in
-- sync, since EventStaffingPlan.role_name is a plain text copy, not a live
-- FK), disable the two runner roles (soft — is_active only, reversible),
-- and add an audit log table for staffing changes.

update "StaffingAgency" set name = 'קירה' where name = 'ריי';

update "StaffingRule" set role_name = 'מנהל מזונונים' where role_name = 'מזנונים' and rule_type = 'REQUIRED_ROLE';
update "EventStaffingPlan" set role_name = 'מנהל מזונונים' where role_name = 'מזנונים';

update "StaffingRule" set is_active = false where role_name in ('ראנר', 'ראנר שני') and rule_type = 'REQUIRED_ROLE';

create table if not exists "StaffingChangeLog" (
  id uuid primary key default gen_random_uuid(),
  month text not null,
  event_id uuid references "Event"(id) on delete cascade,
  event_name text,
  role_name text,
  agency_name text,
  from_value text,
  to_value text,
  created_date timestamptz default now()
);
create index if not exists idx_staffing_change_log_month on "StaffingChangeLog"(month);
create index if not exists idx_staffing_change_log_event on "StaffingChangeLog"(event_id);

NOTIFY pgrst, 'reload schema';
