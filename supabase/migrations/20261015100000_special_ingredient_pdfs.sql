-- Recipe PDFs on sub-dishes (same shape as Dish.pdf_files).
alter table "SpecialIngredient" add column if not exists pdf_files jsonb default '[]';

NOTIFY pgrst, 'reload schema';
