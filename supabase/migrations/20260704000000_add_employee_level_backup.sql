-- Employee-level backup ("עובד חלופי"), configured once per employee on the
-- employees page. When the employee marks they are not coming (to an event, or
-- for a Peti Vor day), this backup receives all their tasks AND any task
-- escalations that pointed at them. Takes precedence over the older per-task
-- mechanisms (template backup_role for event tasks, per-assignment
-- backup_employee for Peti Vor), which remain as fallbacks when unset.
alter table "TaskEmployee" add column if not exists backup_employee_id uuid references "TaskEmployee"(id) on delete set null;
alter table "TaskEmployee" add column if not exists backup_employee_name text;
