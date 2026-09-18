-- Top-level grouping for menu categories: אוכל (food) / שתייה (drink) /
-- מתכלים (consumables). This sits above Category in the dish filter UI —
-- pick a group first, then its categories, then (existing) sub-categories.
ALTER TABLE "Category"
  ADD COLUMN IF NOT EXISTS group_type text NOT NULL DEFAULT 'food'
    CHECK (group_type IN ('food', 'drink', 'consumables'));

-- Every category that exists today is a food-course category.
UPDATE "Category" SET group_type = 'food' WHERE group_type IS NULL;

NOTIFY pgrst, 'reload schema';
