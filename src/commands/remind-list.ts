import {SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags} from 'discord.js';
import { db } from '../db';
import { reminders } from '../db/schema';
import { t } from '../i18n';
import { eq } from 'drizzle-orm';

export const data = new SlashCommandBuilder()
  .setName('remind-list')
  .setDescription(t('remind.list.description'));

export async function execute(interaction: ChatInputCommandInteraction) {
  const targetUserId = interaction.user.id;

  const userReminders = await db
    .select()
    .from(reminders)
    .where(eq(reminders.userId, targetUserId));

  if (userReminders.length === 0) {
    return await interaction.reply({
      content: t('commands.remind.list.empty', { locale: interaction.locale }),
      flags: MessageFlags.Ephemeral,
    });
  }

  const formatted = userReminders
    .map(r => `• \`${r.id}\` — **${r.message}** *(<t:${Math.floor(r.remindAt.getTime() / 1000)}:R>)*`)
    .join('\n');

  await interaction.reply({
    content: t('commands.remind.list.header', { locale: interaction.locale, count: userReminders.length.toString() }) + '\n\n' + formatted,
    flags: MessageFlags.Ephemeral,
  });
}
