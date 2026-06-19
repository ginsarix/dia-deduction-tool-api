ALTER TABLE "project" ADD COLUMN "start_date" date NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "end_date" date NOT NULL;--> statement-breakpoint
ALTER TABLE "project" DROP COLUMN "date";