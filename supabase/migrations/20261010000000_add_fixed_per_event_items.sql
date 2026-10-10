-- Fixed per-event items: dishes under a category flagged fixed_per_event are
-- added once to every event of that event_type (at the dish's
-- fixed_event_qty), outside the guest-count driven dish tree.
alter table "Category" add column if not exists fixed_per_event boolean not null default false;
alter table "Dish" add column if not exists fixed_event_qty numeric;

update "Category" set fixed_per_event = true
  where id = '59279247-6efa-4b1d-936e-3fb1133b44ec';

NOTIFY pgrst, 'reload schema';
