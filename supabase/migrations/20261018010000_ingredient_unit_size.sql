-- Grams (or ml) in one unit of a יחידה ingredient, e.g. 40 for a rosemary
-- sprig. Sub-dishes measured in ק״ג/ליטר count such components by weight
-- instead of 1 unit = 1 ק״ג/ליטר (see src/lib/specialIngredientYield.js).
alter table "Ingredient" add column if not exists unit_size_grams numeric;

NOTIFY pgrst, 'reload schema';
