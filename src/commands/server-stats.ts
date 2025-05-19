import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionsBitField,
  MessageFlags
} from 'discord.js';
import { t } from '../i18n';
import {embedColor} from "../config/embed-color";

export const data = new SlashCommandBuilder()
  .setName('server-stats')
  .setDescription(t('commands.server_stats.description'))
  .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({ content: t('commands.server_stats.error_no_guild'), flags: MessageFlags.Ephemeral });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(t('commands.server_stats.embed_title', { server: guild.name }))
    .addFields(
      { name: t('commands.server_stats.members'), value: `${guild.memberCount}`, inline: true },
      { name: t('commands.server_stats.channels'), value: `${guild.channels.cache.size}`, inline: true },
      { name: t('commands.server_stats.roles'), value: `${guild.roles.cache.size}`, inline: true }
    )
    .setColor(embedColor)
    .setTimestamp();

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}
