-- Allow text ranges (e.g. "10-15") for special guest counts
ALTER TABLE "Event"
  ALTER COLUMN children_count TYPE text USING children_count::text,
  ALTER COLUMN vegan_count TYPE text USING vegan_count::text,
  ALTER COLUMN glatt_count TYPE text USING glatt_count::text;
