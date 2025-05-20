import {
  ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { db } from '../lib/db';
import { autoroles } from '../lib/db/schema';
import { eq } from 'drizzle-orm';
import { t } from '../lib/i18n';

export const data = new SlashCommandBuilder()
  .setName('autorole-show')
  .setDescription(t('commands.autorole_show.description'))
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId && process.env.DEBUG) {
    console.error('Guild ID is missing in interaction');
    return;
  }

  try {
    if (!interaction.guildId) {
      if (process.env.DEBUG) throw new Error('Guild ID is missing');
      return;
    }

    const result = await db.query.autoroles.findFirst({
      where: eq(autoroles.guildId, interaction.guildId),
    });


    if (process.env.DEBUG) {
      console.log(`[AutoroleShow] Fetched autorole for guild ${interaction.guildId}:`, result);
    }

    if (!result) {
      await interaction.reply({
        content: t('commands.autorole_show.notSet'),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.reply({
      content: t('commands.autorole_show.success', { roleId: result.roleId }),
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    console.error('Error executing autorole-show command:', error);
    await interaction.reply({
      content: t('errors.unexpected'),
      flags: MessageFlags.Ephemeral,
    });
  }
}
