ALTER TABLE "Dish" ADD COLUMN IF NOT EXISTS price_per_guest numeric;
ALTER TABLE "Dish" ADD COLUMN IF NOT EXISTS waste_pct numeric;

-- SubCategory may need category_name column too
ALTER TABLE "SubCategory" ADD COLUMN IF NOT EXISTS category_name text;
