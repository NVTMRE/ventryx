CREATE TABLE "auto_roles" (
	"guild_id" text NOT NULL,
	"message_id" text NOT NULL,
	"role_id" text NOT NULL,
	"emoji" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	CONSTRAINT "auto_roles_guild_id_message_id_emoji_pk" PRIMARY KEY("guild_id","message_id","emoji")
);
--> statement-breakpoint
CREATE TABLE "level_config" (
	"guild_id" text PRIMARY KEY NOT NULL,
	"xp_per_message" integer DEFAULT 15 NOT NULL,
	"xp_per_message_variance" integer DEFAULT 10 NOT NULL,
	"xp_per_voice_minute" integer DEFAULT 5 NOT NULL,
	"message_cooldown" integer DEFAULT 60 NOT NULL,
	"ignore_channels" text[] DEFAULT '{}',
	"level_up_message" text DEFAULT '🎉 Gratulacje {user}! Osiągnąłeś poziom **{level}**!',
	"level_up_channel" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "level_roles" (
	"id" text PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"role_id" text NOT NULL,
	"required_level" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_levels" (
	"user_id" text NOT NULL,
	"guild_id" text NOT NULL,
	"total_xp" integer DEFAULT 0 NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"last_message_at" timestamp,
	CONSTRAINT "user_levels_user_id_guild_id_pk" PRIMARY KEY("user_id","guild_id")
);
--> statement-breakpoint
CREATE INDEX "guild_leaderboard_idx" ON "user_levels" USING btree ("guild_id","total_xp");