import {pgTable, serial, timestamp, varchar} from 'drizzle-orm/pg-core';

export const reminders = pgTable('reminders', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id').notNull(),
  message: varchar('message').notNull(),
  remindAt: timestamp('remind_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const autoroles = pgTable('autoroles', {
  guildId: varchar('guild_id').primaryKey(),
  roleId: varchar('role_id').notNull(),
});

export const autoroleReactions = pgTable('autorole_reactions', {
  id: serial('id').primaryKey(),
  guildId: varchar('guild_id', { length: 32 }).notNull(),
  messageId: varchar('message_id', { length: 32 }).notNull(),
  emoji: varchar('emoji', { length: 255 }).notNull(),
  roleId: varchar('role_id', { length: 32 }).notNull(),
  panelId: varchar('panel_id', { length: 64 }).notNull().default('default'),
});