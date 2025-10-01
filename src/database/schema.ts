// src/database/schema.ts

import {
  pgTable,
  text,
  integer,
  timestamp,
  primaryKey,
  index,
  boolean, // ← DODAJ TO
} from "drizzle-orm/pg-core";

export const userLevels = pgTable(
  "user_levels",
  {
    userId: text("user_id").notNull(),
    guildId: text("guild_id").notNull(),
    totalXP: integer("total_xp").notNull().default(0),
    level: integer("level").notNull().default(1),
    lastMessageAt: timestamp("last_message_at"),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.guildId] }),
    guildLeaderboardIdx: index("guild_leaderboard_idx").on(
      table.guildId,
      table.totalXP
    ),
  })
);

export const levelConfig = pgTable("level_config", {
  guildId: text("guild_id").primaryKey(),
  xpPerMessage: integer("xp_per_message").notNull().default(15),
  xpPerMessageVariance: integer("xp_per_message_variance").notNull().default(10),
  xpPerVoiceMinute: integer("xp_per_voice_minute").notNull().default(5),
  messageCooldown: integer("message_cooldown").notNull().default(60),
  ignoreChannels: text("ignore_channels").array().default([]),
  levelUpMessage: text("level_up_message").default(
    "🎉 Gratulacje {user}! Osiągnąłeś poziom **{level}**!"
  ),
  levelUpChannel: text("level_up_channel"),
  enabled: boolean("enabled").notNull().default(true),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const levelRoles = pgTable("level_roles", {
  id: text("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  roleId: text("role_id").notNull(),
  requiredLevel: integer("required_level").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type UserLevel = typeof userLevels.$inferSelect;
export type NewUserLevel = typeof userLevels.$inferInsert;
export type LevelConfig = typeof levelConfig.$inferSelect;
export type NewLevelConfig = typeof levelConfig.$inferInsert;
export type LevelRole = typeof levelRoles.$inferSelect;
export type NewLevelRole = typeof levelRoles.$inferInsert;