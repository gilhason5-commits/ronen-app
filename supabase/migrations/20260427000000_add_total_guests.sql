-- Add total_guests (manual input "סה״כ אורחים") and convert children_count to integer
-- guest_count remains the calculation source: guest_count = total_guests - children_count

-- 1) Add total_guests column
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS total_guests integer;

-- 2) Backfill total_guests for existing rows: total_guests = guest_count + max(children_count)
-- For existing children_count text values: handle "5-10" → 10, "5" → 5, null/empty → 0
UPDATE "Event"
SET total_guests = COALESCE(guest_count, 0) + COALESCE(
  CASE
    WHEN children_count IS NULL OR TRIM(children_count) = '' THEN 0
    WHEN children_count ~ '^\d+$' THEN children_count::integer
    WHEN children_count ~ '^\d+\s*-\s*\d+$' THEN
      GREATEST(
        SPLIT_PART(REGEXP_REPLACE(children_count, '\s', '', 'g'), '-', 1)::integer,
        SPLIT_PART(REGEXP_REPLACE(children_count, '\s', '', 'g'), '-', 2)::integer
      )
    ELSE 0
  END, 0)
WHERE total_guests IS NULL;

-- 3) Convert children_count from text to integer (use max of any range)
ALTER TABLE "Event"
  ALTER COLUMN children_count TYPE integer USING (
    CASE
      WHEN children_count IS NULL OR TRIM(children_count) = '' THEN NULL
      WHEN children_count ~ '^\d+$' THEN children_count::integer
      WHEN children_count ~ '^\d+\s*-\s*\d+$' THEN
        GREATEST(
          SPLIT_PART(REGEXP_REPLACE(children_count, '\s', '', 'g'), '-', 1)::integer,
          SPLIT_PART(REGEXP_REPLACE(children_count, '\s', '', 'g'), '-', 2)::integer
        )
      ELSE NULL
    END
  );
