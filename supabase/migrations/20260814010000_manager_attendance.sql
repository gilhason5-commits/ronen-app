-- Manager check-in/out on the event attendance page: the day-of "who's
-- present" header for the 9 internal management roles (event manager,
-- deputies, porch, buffet, entrance, wine station, family, host). Reuses
-- EventStaffingPlan (already has role_name/assigned_name/note) instead of a
-- new table, since planning and day-of attendance are the same row.

alter table "EventStaffingPlan" add column if not exists clock_in text;
alter table "EventStaffingPlan" add column if not exists clock_out text;

NOTIFY pgrst, 'reload schema';
