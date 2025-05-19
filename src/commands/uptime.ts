import {ChatInputCommandInteraction, MessageFlags, PermissionsBitField, SlashCommandBuilder} from 'discord.js';
import { t } from '../i18n';

const startTime = Date.now(); // Save when the bot started

export const data = new SlashCommandBuilder()
  .setName('uptime')
  .setDescription(t('commands.uptime.description'))
  .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  const now = Date.now();
  const diff = now - startTime;

  // Format milliseconds into D:HH:MM:SS
  const seconds = Math.floor(diff / 1000) % 60;
  const minutes = Math.floor(diff / 1000 / 60) % 60;
  const hours = Math.floor(diff / 1000 / 60 / 60) % 24;
  const days = Math.floor(diff / 1000 / 60 / 60 / 24);

  const uptimeString = `${days}d ${hours}h ${minutes}m ${seconds}s`;

  await interaction.reply({
    content: t('commands.uptime.response', { uptime: uptimeString }),
    flags: MessageFlags.Ephemeral
  });
}
