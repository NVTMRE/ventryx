import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionsBitField, MessageFlags,
} from 'discord.js';
import { db } from '../lib/db';
import { reminders } from '../lib/db/schema';
import { t } from '../lib/i18n';
import { eq } from 'drizzle-orm';

export const data = new SlashCommandBuilder()
  .setName('remind-cancel')
  .setDescription(t('commands.remind.cancel.description'))
  .addStringOption(option =>
    option
      .setName('id')
      .setDescription(t('commands.remind.cancel.option_id'))
      .setRequired(true),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const id = interaction.options.getString('id', true);
  const userId = interaction.user.id;
  const isAdmin = interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator);

  const reminder = await db.query.reminders.findFirst({
    where: (r, { eq }) => eq(r.id, Number(id)),
  });

  if (!reminder) {
    return interaction.reply({
      content: t('commands.remind.cancel.not_found', { locale: interaction.locale }),
      flags: MessageFlags.Ephemeral,
    });
  }

  if (!isAdmin && reminder.userId !== userId) {
    return interaction.reply({
      content: t('commands.remind.cancel.permission_denied', { locale: interaction.locale }),
      flags: MessageFlags.Ephemeral,
    });
  }

  await db.delete(reminders).where(eq(reminders.id, Number(id)));

  return interaction.reply({
    content: t('commands.remind.cancel.success', { locale: interaction.locale }),
    flags: MessageFlags.Ephemeral,
  });
}
