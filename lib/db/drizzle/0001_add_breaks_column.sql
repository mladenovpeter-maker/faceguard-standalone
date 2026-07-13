ALTER TABLE "department_work_schedules" ADD COLUMN IF NOT EXISTS "breaks" json DEFAULT '[]'::json NOT NULL;
--> statement-breakpoint
ALTER TABLE "zone_work_schedules" ADD COLUMN IF NOT EXISTS "breaks" json DEFAULT '[]'::json NOT NULL;
