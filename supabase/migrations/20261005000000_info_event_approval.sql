-- Second event approval by the main "info" user. Either approval moves the
-- event to management (status in_progress + its tasks); once both the
-- producer and info have approved, the headcount is final and the event
-- form locks it.
alter table "Event" add column if not exists info_approved boolean not null default false;
alter table "Event" add column if not exists info_approved_at timestamptz;
NOTIFY pgrst, 'reload schema';
