import {
  ChatInputCommandInteraction, MessageFlags,
  PermissionFlagsBits, Role,
  SlashCommandBuilder,
} from 'discord.js';
import { db } from '../lib/db';
import { autoroles } from '../lib/db/schema';
import { eq } from 'drizzle-orm';
import { t } from '../lib/i18n';

export const data = new SlashCommandBuilder()
  .setName('autorole-set')
  .setDescription(t('commands.autorole_set.description'))
  .addRoleOption(option =>
    option
      .setName('role')
      .setDescription(t('commands.autorole_set.options.role'))
      .setRequired(true),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId || !interaction.guild) {
    return interaction.reply({
      content: '❌ Guild ID is missing.',
      flags: MessageFlags.Ephemeral,
    });
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const role = interaction.options.getRole('role', true) as Role;

    const existing = await db.query.autoroles.findFirst({
      where: eq(autoroles.guildId, interaction.guildId),
    });

    const newRoleId = role.id;

    if (existing) {
      const oldRole = await interaction.guild.roles.fetch(existing.roleId).catch(() => null);
      if (oldRole) {
        const membersWithOldRole = await interaction.guild.members.fetch();
        for (const member of membersWithOldRole.values()) {
          if (member.roles.cache.has(oldRole.id)) {
            await member.roles.remove(oldRole).catch(err =>
              console.warn(`[AutoRole] Couldn't remove old role from ${member.user.tag}:`, err.message)
            );
          }
        }
      }

      await db.update(autoroles)
        .set({ roleId: newRoleId })
        .where(eq(autoroles.guildId, interaction.guildId));
    } else {
      await db.insert(autoroles).values({
        guildId: interaction.guildId,
        roleId: newRoleId,
      });
    }

    const members = await interaction.guild.members.fetch();
    for (const member of members.values()) {
      if (!member.user.bot) {
        await member.roles.add(role).catch(err =>
          console.warn(`[AutoRole] Couldn't assign new role to ${member.user.tag}:`, err.message)
        );
      }
    }

    await interaction.editReply({
      content: t('commands.autorole_set.success', { roleId: newRoleId }),
    });
  } catch (error) {
    console.error(`[Autorole Set] Error:`, error);
    if (!interaction.replied) {
      await interaction.editReply({
        content: t('commands.autorole_set.error', {
          message: (error as Error).message,
        }),
      });
    }
  }
}
