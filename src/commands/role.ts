import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionsBitField,
  MessageFlags,
  Role,
} from 'discord.js';
import { t } from '../lib/i18n';

// Simple in-memory storage for autorole panel roles (replace with real DB)
const autorolePanel = new Map<string, Role>();

export const data = new SlashCommandBuilder()
  .setName('role')
  .setDescription(t('commands.role.description'))
  .addSubcommand(subcommand =>
    subcommand
      .setName('set')
      .setDescription(t('commands.role.set.description'))
      .addRoleOption(option =>
        option
          .setName('role')
          .setDescription(t('commands.role.set.option_role'))
          .setRequired(true)
      )
      // Optional user parameter: if present, admin assigns role to this user
      .addUserOption(option =>
        option
          .setName('user')
          .setDescription(t('commands.role.set.option_user'))
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('add')
      .setDescription(t('commands.role.add.description'))
      .addRoleOption(option =>
        option
          .setName('role')
          .setDescription(t('commands.role.add.option_role'))
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('remove')
      .setDescription(t('commands.role.remove.description'))
      .addRoleOption(option =>
        option
          .setName('role')
          .setDescription(t('commands.role.remove.option_role'))
          .setRequired(true)
      )
  )
  .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();

  try {
    if (subcommand === 'set') {
      const role = interaction.options.getRole('role', true) as Role;
      const user = interaction.options.getUser('user', false);
      const guild = interaction.guild;
      if (!guild) {
        return interaction.reply({
          content: t('commands.role.error_no_guild'),
          flags: MessageFlags.Ephemeral,
        });
      }

      // If user param is set (assigning a role to someone else)
      if (user) {
        // Check if the interaction user has admin permissions
        if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
          return interaction.reply({
            content: t('commands.role.error_no_permission_assign_other'),
            flags: MessageFlags.Ephemeral,
          });
        }

        // Fetch the member object of the target user
        const targetMember = await guild.members.fetch(user.id).catch(() => null);
        if (!targetMember) {
          return interaction.reply({
            content: t('commands.role.error_user_not_found'),
            flags: MessageFlags.Ephemeral,
          });
        }

        // Assign the role to the target user
        await targetMember.roles.add(role).catch(() => null);
        return interaction.reply({
          content: t('commands.role.set.assigned_other', { roleId: role.id, userId: user.id }),
          flags: MessageFlags.Ephemeral,
        });
      } else {
        // No user param: assign role to self
        const member = await guild.members.fetch(interaction.user.id).catch(() => null);

        if (!member) {
          return interaction.reply({
            content: t('commands.role.error_no_member'),
            flags: MessageFlags.Ephemeral,
          });
        }

        await member.roles.add(role).catch(() => null);
        return interaction.reply({
          content: t('commands.role.set.assigned_self', { roleId: role.id }),
          flags: MessageFlags.Ephemeral,
        });
      }
    } else if (subcommand === 'add') {
      // Only admins can add roles to an autorole panel
      if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
        return interaction.reply({
          content: t('commands.role.error_no_permission'),
          flags: MessageFlags.Ephemeral,
        });
      }

      const role = interaction.options.getRole('role', true);
      if (autorolePanel.has(role.id)) {
        return interaction.reply({
          content: t('commands.role.add.already_exists', { roleId: role.id }),
          flags: MessageFlags.Ephemeral,
        });
      }
      if (role instanceof Role) {
        autorolePanel.set(role.id, role);
      }
      return interaction.reply({
        content: t('commands.role.add.success', { roleId: role.id }),
        flags: MessageFlags.Ephemeral,
      });
    } else if (subcommand === 'remove') {
      // Only admins can remove roles from an autorole panel
      if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
        return interaction.reply({
          content: t('commands.role.error_no_permission'),
          flags: MessageFlags.Ephemeral,
        });
      }

      const role = interaction.options.getRole('role', true);
      if (!autorolePanel.has(role.id)) {
        return interaction.reply({
          content: t('commands.role.remove.not_found', { roleId: role.id }),
          flags: MessageFlags.Ephemeral,
        });
      }
      autorolePanel.delete(role.id);
      return interaction.reply({
        content: t('commands.role.remove.success', { roleId: role.id }),
        flags: MessageFlags.Ephemeral,
      });
    } else {
      return interaction.reply({
        content: t('commands.role.error_unknown_subcommand'),
        flags: MessageFlags.Ephemeral,
      });
    }
  } catch (error) {
    console.error('Role command error:', error);
    return interaction.reply({
      content: t('commands.role.error_generic'),
      flags: MessageFlags.Ephemeral,
    });
  }
}
