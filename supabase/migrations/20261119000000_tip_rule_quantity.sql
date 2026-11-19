-- Fixed-amount tip rules need a headcount, not only a price (e.g. 2 security
-- guards × 300 ₪). The deduction becomes value × quantity; existing rules keep
-- quantity 1, so nothing changes until someone edits it.
alter table "TipRule" add column if not exists quantity numeric not null default 1;
notify pgrst, 'reload schema';
