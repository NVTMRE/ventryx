ALTER TABLE "level_roles" RENAME COLUMN "required_level" TO "min_level";--> statement-breakpoint
ALTER TABLE "level_roles" ADD COLUMN "max_level" integer NOT NULL;