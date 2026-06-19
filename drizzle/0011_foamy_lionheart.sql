ALTER TABLE "project_workers" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "project_workers" CASCADE;--> statement-breakpoint
ALTER TABLE "month_workers" DROP CONSTRAINT "month_workers_project_id_project_id_fk";
--> statement-breakpoint
ALTER TABLE "month_workers" DROP CONSTRAINT "month_workers_month_id_worker_id_pk";--> statement-breakpoint
ALTER TABLE "month_workers" ALTER COLUMN "project_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "month_workers" ADD CONSTRAINT "month_workers_month_id_project_id_worker_id_pk" PRIMARY KEY("month_id","project_id","worker_id");--> statement-breakpoint
ALTER TABLE "month_workers" ADD CONSTRAINT "month_workers_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;