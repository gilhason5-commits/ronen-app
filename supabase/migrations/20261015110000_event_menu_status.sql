-- Menu status vs. the couple (open / closed), shown as a dot on the calendar.
alter table "Event" add column if not exists menu_status text default 'open';

NOTIFY pgrst, 'reload schema';
