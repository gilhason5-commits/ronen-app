-- Manual dish order in "מנות ותפריטים" (up/down arrows). Null sorts last,
-- by name, so existing dishes keep their alphabetical order until moved.
alter table "Dish" add column if not exists display_order integer;

-- Fixed per-event items now honour qty_mode like any dish. Until now the app
-- ignored it for them (and forced 'percent' on save) and always used
-- fixed_event_qty (default 1), so move the existing ones to 'fixed' to keep
-- their quantities unchanged.
update "Dish" d
set qty_mode = 'fixed',
    fixed_event_qty = coalesce(d.fixed_event_qty, 1)
where exists (
  select 1 from "Category" c
  where c.fixed_per_event and d.categories ? c.id::text
);

NOTIFY pgrst, 'reload schema';
