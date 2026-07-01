-- Backup employee for Peti Vor recurring tasks.
-- Unlike event tasks (role-based backup on the template), Peti Vor tasks carry a
-- specific backup employee chosen per assignment. When the assignee marks
-- unavailable for the day, that day's task is handed to this employee.
alter table "TaskAssignment" add column if not exists backup_employee_id uuid;
alter table "TaskAssignment" add column if not exists backup_employee_name text;
alter table "TaskAssignment" add column if not exists backup_employee_phone text;
