ALTER TABLE "worker" RENAME COLUMN "registration_number" TO "dia_key";--> statement-breakpoint
ALTER TABLE "worker" DROP CONSTRAINT "worker_registration_number_connection_id_unique";--> statement-breakpoint
ALTER TABLE "worker" ADD CONSTRAINT "worker_dia_key_connection_id_unique" UNIQUE("dia_key","connection_id");