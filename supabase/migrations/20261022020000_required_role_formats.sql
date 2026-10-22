-- ספר התקנים: a required-role standard can be limited to some event formats
-- (e.g. הגשה + הפוכה, or טעימות only). Empty/null = applies to every format.
alter table "StaffingRule" add column if not exists event_formats text[];
