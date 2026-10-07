-- Price/supplier changes on an ingredient take effect from a chosen date
-- (effective_from), possibly in the future. Events dated before it keep the
-- old price and supplier (event food cost and purchase orders). A future
-- change waits with applied = false until /api/apply-ingredient-changes
-- copies it onto the Ingredient row on that date.
--
-- Each row records only what it changed: price_changed → old/new price
-- fields, supplier_changed → old/new supplier fields.
alter table "Ingredient_Price_History"
  add column if not exists effective_from date,
  add column if not exists applied boolean not null default true,
  add column if not exists price_changed boolean not null default true,
  add column if not exists supplier_changed boolean not null default false,
  add column if not exists old_purchase_unit numeric,
  add column if not exists new_purchase_unit numeric,
  add column if not exists old_supplier_id uuid references "Supplier"(id) on delete set null,
  add column if not exists old_supplier_name text,
  add column if not exists new_supplier_id uuid references "Supplier"(id) on delete set null,
  add column if not exists new_supplier_name text;

-- Existing rows were immediate price changes logged on their change_date.
update "Ingredient_Price_History"
  set effective_from = coalesce(change_date, created_date::date)
  where effective_from is null;

create index if not exists ingredient_price_history_ingredient_effective_idx
  on "Ingredient_Price_History" (ingredient_id, effective_from);

NOTIFY pgrst, 'reload schema';
