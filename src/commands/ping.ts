import {
  ChatInputCommandInteraction,
  PermissionsBitField,
  SlashCommandBuilder,
  EmbedBuilder,
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

  if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
    await interaction.reply({ content: t('commands.server_stats.error_no_perm'), flags: MessageFlags.Ephemeral });
    return;
  }

  try {
    const totalMembers = guild.memberCount;
    const members = await guild.members.fetch();
    const humans = members.filter(m => !m.user.bot).size;
    const bots = members.filter(m => m.user.bot).size;

    const textChannels = guild.channels.cache.filter(c => c.isTextBased()).size;
    const voiceChannels = guild.channels.cache.filter(c => c.isVoiceBased()).size;

    const embed = new EmbedBuilder()
      .setTitle(t('commands.server_stats.title'))
      .addFields(
        { name: t('commands.server_stats.total_members'), value: `${totalMembers}`, inline: true },
        { name: t('commands.server_stats.humans'), value: `${humans}`, inline: true },
        { name: t('commands.server_stats.bots'), value: `${bots}`, inline: true },
        { name: t('commands.server_stats.text_channels'), value: `${textChannels}`, inline: true },
        { name: t('commands.server_stats.voice_channels'), value: `${voiceChannels}`, inline: true },
        { name: t('commands.server_stats.server_id'), value: guild.id, inline: true }
      )
      .setColor(embedColor)
      .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  } catch (error) {
    console.error('Server stats error:', error);
    await interaction.reply({ content: t('commands.server_stats.error'), flags: MessageFlags.Ephemeral });
  }
}
