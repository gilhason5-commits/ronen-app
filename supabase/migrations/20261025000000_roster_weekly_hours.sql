-- Fixed weekly hours per roster member, kept regardless of events
-- (e.g. a setup worker every Friday 07:00-11:00). Keys are weekdays
-- "0" (Sunday) .. "6" (Saturday): {"5": {"in": "07:00", "out": "11:00"}}.
alter table "KitchenRosterMember" add column if not exists weekly_hours jsonb;

-- IAN (בר row): every Friday 07:00-11:00.
update "KitchenRosterMember"
set weekly_hours = '{"5": {"in": "07:00", "out": "11:00"}}'::jsonb
where id = 'f993bdcb-45f0-4ed2-94c7-ae34bf32e4f5';
