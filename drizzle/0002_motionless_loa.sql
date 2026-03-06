ALTER TABLE "worker" DROP CONSTRAINT "worker_registration_number_unique";--> statement-breakpoint
ALTER TABLE "connection" ADD COLUMN "session_id" text;--> statement-breakpoint
ALTER TABLE "worker" ADD COLUMN "connection_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "worker" ADD CONSTRAINT "worker_connection_id_connection_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker" ADD CONSTRAINT "worker_registration_number_connection_id_unique" UNIQUE("registration_number","connection_id");