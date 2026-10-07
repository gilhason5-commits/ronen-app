-- Employee card (כרטיס עובד) fields from the new card layout.
alter table "TaskEmployee"
  add column if not exists secondary_role_id uuid references "EmployeeRole"(id) on delete set null,
  add column if not exists secondary_role_name text,
  add column if not exists secondary_rate numeric,          -- pay in the additional role
  add column if not exists travel_type text,                -- 'daily' | 'monthly'
  add column if not exists travel_amount numeric,           -- ₪ per day / monthly pass
  add column if not exists salary_basis text,               -- 'net' | 'gross'
  add column if not exists employer_cost_hourly numeric,    -- total employer cost per hour
  add column if not exists employer_cost_global numeric,    -- total employer cost, global
  add column if not exists certifications text;             -- additional certifications / training

NOTIFY pgrst, 'reload schema';
