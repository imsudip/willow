CREATE TABLE "user_config" (
	"user_id" text PRIMARY KEY NOT NULL,
	"config" jsonb DEFAULT '{"reminderTime":"18:30","chimesEnabled":true,"appearance":"system"}'::jsonb NOT NULL,
	"openai_api_key_enc" text,
	"key_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "entries" ALTER COLUMN "updated_at_epoch_ms" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "user_config" ADD CONSTRAINT "user_config_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_config_key_updated_idx" ON "user_config" USING btree ("key_updated_at");