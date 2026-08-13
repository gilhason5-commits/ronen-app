-- Extra roles/agency seen on the paper staffing sheet (מפת כוח אדם) that
-- weren't in the original rule book: lighting, family-table waitress, and
-- escorts, plus Ray's own in-house waiters as a third staffing source
-- alongside the עמי/איגור agencies. All editable later from הגדרות תקנים.

insert into "StaffingRule" (rule_type, role_name, event_format, min_guests, max_guests, quantity, arrival_offset_minutes, params, explanation, sort_order, is_active)
select * from (values
  ('REQUIRED_ROLE', 'תאורנים',       null::text, 0::int, null::int, 1::int, null::int, '{}'::jsonb, 'תאורנים — נוסף מהמפה השטוחה, לעדכן תנאים בהגדרות אם צריך', 21, true),
  ('REQUIRED_ROLE', 'מלווים',        null::text, 0::int, null::int, 1::int, null::int, '{}'::jsonb, 'מלווים — נוסף מהמפה השטוחה, לעדכן תנאים בהגדרות אם צריך', 22, true),
  ('REQUIRED_ROLE', 'מלצרית משפחה',  null::text, 0::int, null::int, 1::int, null::int, '{}'::jsonb, 'מלצרית משפחה — נוסף מהמפה השטוחה, לעדכן תנאים בהגדרות אם צריך', 23, true)
) v(rule_type, role_name, event_format, min_guests, max_guests, quantity, arrival_offset_minutes, params, explanation, sort_order, is_active)
where not exists (
  select 1 from "StaffingRule" s where s.rule_type = v.rule_type and s.role_name = v.role_name
);

insert into "StaffingAgency" (name, max_waiters_per_event, sort_order, is_active)
select 'ריי', null::int, 3, true
where not exists (select 1 from "StaffingAgency" where name = 'ריי');

-- Clean up an earlier, superseded attempt that bolted free-text staffing
-- columns directly onto Event before this migration's author noticed the
-- real staffing/tips module already lived on main. Unused, nothing reads them.
alter table "Event" drop column if exists updated_guest_count;
alter table "Event" drop column if exists ray_staff_count;
alter table "Event" drop column if exists ami_staff_count;
alter table "Event" drop column if exists igor_staff_count;
alter table "Event" drop column if exists lighting_staff;
alter table "Event" drop column if exists event_manager;
alter table "Event" drop column if exists sag1_staff;
alter table "Event" drop column if exists sag2_staff;
alter table "Event" drop column if exists callers_staff;
alter table "Event" drop column if exists porch_staff;
alter table "Event" drop column if exists family_staff;
alter table "Event" drop column if exists entrance_staff;
alter table "Event" drop column if exists symbolia_staff;
alter table "Event" drop column if exists escort_staff;
alter table "Event" drop column if exists waiters_staff;

NOTIFY pgrst, 'reload schema';
