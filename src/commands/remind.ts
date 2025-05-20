import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionsBitField, MessageFlags,
} from 'discord.js';
import { t } from '../lib/i18n';
import { db } from '../lib/db';
import { reminders } from '../lib/db/schema';
import { addMinutes } from 'date-fns';

export const data = new SlashCommandBuilder()
  .setName('remind')
  .setDescription(t('commands.remind.description'))
  .addIntegerOption(option =>
    option
      .setName('time')
      .setDescription(t('commands.remind.options.time'))
      .setRequired(true),
  )
  .addStringOption(option =>
    option
      .setName('message')
      .setDescription(t('commands.remind.options.message'))
      .setRequired(true),
  )
  .addUserOption(option =>
    option
      .setName('user')
      .setDescription(t('commands.remind.options.user'))
      .setRequired(false),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const minutes = interaction.options.getInteger('time', true);
  const message = interaction.options.getString('message', true);
  const targetUser = interaction.options.getUser('user') ?? interaction.user;

  const isSelf = targetUser.id === interaction.user.id;
  const isAdmin = interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator);

  if (!isSelf && !isAdmin) {
    return await interaction.reply({
      content: t('commands.remind.permission_denied', { locale: interaction.locale }),
      flags: MessageFlags.Ephemeral,
    });
  }

  const remindAt = addMinutes(new Date(), minutes);

  await db.insert(reminders).values({
    userId: targetUser.id,
    message,
    remindAt,
  });

  await interaction.reply({
    content: t('commands.remind.confirmation', {
      locale: interaction.locale,
      minutes: minutes.toString(),
      user: isSelf ? t('commands.remind.you', { locale: interaction.locale }) : `<@${targetUser.id}>`,
    }),
    flags: MessageFlags.Ephemeral,
  });
}
