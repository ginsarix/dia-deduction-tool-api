ALTER TABLE "project" ALTER COLUMN "sgk5510_employee_share_rate" SET DATA TYPE numeric(6, 4);--> statement-breakpoint
ALTER TABLE "project" ALTER COLUMN "sgk5510_employee_share_rate" SET DEFAULT 0.14;--> statement-breakpoint
ALTER TABLE "project" ALTER COLUMN "sgk5510_employer_share_rate" SET DATA TYPE numeric(6, 4);--> statement-breakpoint
ALTER TABLE "project" ALTER COLUMN "sgk5510_employer_share_rate" SET DEFAULT 0.2175;--> statement-breakpoint
ALTER TABLE "project" ALTER COLUMN "sgk5746_employer_share_rate" SET DATA TYPE numeric(6, 4);--> statement-breakpoint
ALTER TABLE "project" ALTER COLUMN "sgk5746_employer_share_rate" SET DEFAULT 0.2175;--> statement-breakpoint
ALTER TABLE "project_workers" ALTER COLUMN "gross_base_salary" SET DATA TYPE numeric(15, 2);--> statement-breakpoint
ALTER TABLE "project_workers" ALTER COLUMN "overtime_additional_pay" SET DATA TYPE numeric(15, 2);--> statement-breakpoint
ALTER TABLE "project_workers" ALTER COLUMN "monthly_upper_limit" SET DATA TYPE numeric(15, 2);--> statement-breakpoint
ALTER TABLE "project_workers" ALTER COLUMN "income_tax_rate" SET DATA TYPE numeric(6, 4);--> statement-breakpoint
ALTER TABLE "project_workers" ALTER COLUMN "agi" SET DATA TYPE numeric(15, 2);--> statement-breakpoint
ALTER TABLE "project_workers" ALTER COLUMN "argeExemptionRate" SET DATA TYPE numeric(6, 4);