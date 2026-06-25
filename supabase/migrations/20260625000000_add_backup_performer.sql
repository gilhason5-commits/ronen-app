-- Backup performer for event tasks.
-- When the primary assignee marks they are not coming (CONFIRMED_UNAVAILABLE),
-- the task is auto-reassigned to the active employee filling the backup role.
-- The backup role is defined once on the template and snapshotted onto each
-- generated assignment (mirroring how escalation_role_id is already copied),
-- so the reassignment hook reads it straight off the TaskAssignment row.

-- Template: the configured backup role (set in TaskTemplateDialog).
alter table "TaskTemplate" add column if not exists backup_role_id uuid references "EmployeeRole"(id) on delete set null;
alter table "TaskTemplate" add column if not exists backup_role_name text;

-- Assignment: backup role snapshot + who the task originally belonged to
-- (used for the "moved from X" indicator and for restoring on re-confirm).
alter table "TaskAssignment" add column if not exists backup_role_id uuid;
alter table "TaskAssignment" add column if not exists backup_role_name text;
alter table "TaskAssignment" add column if not exists original_assigned_to_id uuid;
alter table "TaskAssignment" add column if not exists original_assigned_to_name text;
