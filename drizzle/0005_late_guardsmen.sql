ALTER TABLE "project" ADD COLUMN "sgk5510_employee_share_rate" numeric(4, 2) DEFAULT 0.14;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "sgk5510_employee_unemployment_share_rate" numeric(4, 2) DEFAULT 0.01;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "sgk5510_employer_share_rate" numeric(4, 2) DEFAULT 0.2175;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "sgk5510_employer_unemployment_share_rate" numeric(4, 2) DEFAULT 0.03;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "sgk5746_employer_share_rate" numeric(4, 2) DEFAULT 0.2175;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "sgk5746_employer_unemployment_share_rate" numeric(4, 2) DEFAULT 0.02;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "income_tax_sgk5746_employee_share_rate" numeric(4, 2) DEFAULT 0.14;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "income_tax_sgk5746_employee_unemployment_share_rate" numeric(4, 2) DEFAULT 0.01;--> statement-breakpoint
ALTER TABLE "project_workers" ADD COLUMN "arge_center_work_days" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "project_workers" ADD COLUMN "other_activities_work_days" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "project_workers" ADD COLUMN "total_work_days" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "project_workers" ADD COLUMN "gross_base_salary" numeric(4, 2) DEFAULT 0;--> statement-breakpoint
ALTER TABLE "project_workers" ADD COLUMN "overtime_additional_pay" numeric(4, 2) DEFAULT 0;--> statement-breakpoint
ALTER TABLE "project_workers" ADD COLUMN "monthly_upper_limit" numeric(4, 2) DEFAULT 0;--> statement-breakpoint
ALTER TABLE "project_workers" ADD COLUMN "income_tax_rate" numeric(4, 2) DEFAULT 0;--> statement-breakpoint
ALTER TABLE "project_workers" ADD COLUMN "agi" numeric(4, 2) DEFAULT 0;--> statement-breakpoint
ALTER TABLE "project_workers" ADD COLUMN "argeExemptionRate" numeric(4, 2) DEFAULT 0;--> statement-breakpoint
ALTER TABLE "worker" ADD COLUMN "tc" varchar(11) NOT NULL;--> statement-breakpoint
ALTER TABLE "worker" ADD COLUMN "department" text NOT NULL;--> statement-breakpoint
ALTER TABLE "worker" ADD COLUMN "branch" text NOT NULL;--> statement-breakpoint
ALTER TABLE "worker" ADD COLUMN "mission" text;--> statement-breakpoint
ALTER TABLE "worker" ADD CONSTRAINT "worker_tc_unique" UNIQUE("tc");