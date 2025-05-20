import {pgTable, serial, text, timestamp} from 'drizzle-orm/pg-core';

export const reminders = pgTable('reminders', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  message: text('message').notNull(),
  remindAt: timestamp('remind_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const autoroles = pgTable('autoroles', {
  guildId: text('guild_id').primaryKey(),
  roleId: text('role_id').notNull(),
});