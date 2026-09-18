-- Free-text employment agreement reference and a general note field per
-- employee, editable from עמוד עובדים.
ALTER TABLE "TaskEmployee"
  ADD COLUMN IF NOT EXISTS work_agreement text,
  ADD COLUMN IF NOT EXISTS note text;

NOTIFY pgrst, 'reload schema';
