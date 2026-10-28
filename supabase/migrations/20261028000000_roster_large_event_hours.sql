-- Hours a roster member works instead of their default hours on days with at
-- least min_guests guests: {"min_guests": 201, "in": "18:00", "out": "00:01"}.
-- Fixed weekly hours still take precedence (IAN keeps Friday 07:00-11:00).
alter table "KitchenRosterMember" add column if not exists large_event_hours jsonb;

-- IAN (בר row): 18:00-00:01 on days with 201+ guests.
update "KitchenRosterMember"
set large_event_hours = '{"min_guests": 201, "in": "18:00", "out": "00:01"}'::jsonb
where id = 'f993bdcb-45f0-4ed2-94c7-ae34bf32e4f5';
