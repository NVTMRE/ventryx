import { Client, EmbedBuilder } from 'discord.js';
import { db } from '../db';
import { reminders } from '../db/schema';
import { lt, eq } from 'drizzle-orm';
import { t } from '../i18n';
import {embedColor} from "../config/embed-color";

if (process.env.DEBUG) {
  console.log(`[Reminder Worker] Loaded at ${new Date().toISOString()}`);
}

export async function run(client: Client) {
  const now = new Date();
  const dueReminders = await db.select().from(reminders).where(lt(reminders.remindAt, now));

  for (const reminder of dueReminders) {
    try {
      const user = await client.users.fetch(reminder.userId);

      const embed = new EmbedBuilder()
        .setTitle(t('commands.remind.embed.title'))
        .setDescription(reminder.message)
        .setColor(embedColor)
        .setFooter({ text: t('commands.remind.embed.footer') })
        .setTimestamp(new Date());

      await user.send({ embeds: [embed] });
      process.env.DEBUG && console.warn(`[Reminder Worker] Send remind to ${user.displayName} (${user.id}) at ${reminder.remindAt.toISOString()}`);

      await db.delete(reminders).where(eq(reminders.id, reminder.id));
    } catch (error: any) {
      if (error.code === 50007) {
        process.env.DEBUG && console.warn(`[Reminder Worker] Cannot send message to user ${reminder.userId}, removing reminder.`);
        await db.delete(reminders).where(eq(reminders.id, reminder.id));
      } else {
        process.env.DEBUG && console.error(`[Reminder Worker] Failed to send reminder to user ${reminder.userId}:`, error);
      }
    }
  }
}
