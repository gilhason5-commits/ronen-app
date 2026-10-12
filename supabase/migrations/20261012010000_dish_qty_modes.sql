-- How a dish's quantity in an event is decided:
--   percent    — guests × serving_percentage (the existing behaviour, default)
--   fixed      — the same fixed_event_qty in every event (e.g. 5 vegan plates)
--   per_guests — per_guests_qty for every per_guests_base guests
--                (e.g. 5 per 100 → 15 for 300 guests)
alter table "Dish" add column if not exists qty_mode text not null default 'percent'
  check (qty_mode in ('percent', 'fixed', 'per_guests'));
alter table "Dish" add column if not exists per_guests_qty numeric;
alter table "Dish" add column if not exists per_guests_base numeric default 100;

NOTIFY pgrst, 'reload schema';
