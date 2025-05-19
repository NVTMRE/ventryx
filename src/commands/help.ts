import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionsBitField,
  Client,
  Collection, MessageFlags,
} from 'discord.js';
import { t } from '../i18n';

/**
 * Slash command data for /help
 */
export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription(t('commands.help.description'));

/**
 * Execute the /help command
 * @param interaction The interaction object from Discord.js
 */
export async function execute(interaction: ChatInputCommandInteraction) {
  const client = interaction.client as Client & { commands: Collection<string, any> };
  const commands = client.commands;

  // Get user permissions
  const userPermissions = interaction.memberPermissions ?? new PermissionsBitField();

  // Separate commands into admin and user based on permissions
  const userCommands = commands.filter((cmd: any) => {
    const requiredPerms = cmd.data.default_member_permissions;
    if (!requiredPerms) return true; // No perms required, visible to all

    // If command requires permissions and user doesn't have them, exclude here
    const required = new PermissionsBitField(BigInt(requiredPerms));
    return !required.has(PermissionsBitField.Flags.Administrator) || !userPermissions.has(required);
  });

  const adminCommands = commands.filter((cmd: any) => {
    const requiredPerms = cmd.data.default_member_permissions;
    if (!requiredPerms) return false; // Commands without required perms nie są adminowskie

    const required = new PermissionsBitField(BigInt(requiredPerms));
    // Include only if admin perms required and user has admin perms
    return required.has(PermissionsBitField.Flags.Administrator) && userPermissions.has(required);
  });

  // Format user commands list
  const userCommandsList = userCommands
    .map(cmd => {
      const name = cmd.data.name;
      const description = t(`commands.${name}.description`) || cmd.data.description;
      return `**/${name}** — ${description}`;
    })
    .join('\n');

  // Format admin commands list
  const adminCommandsList = adminCommands
    .map(cmd => {
      const name = cmd.data.name;
      const description = t(`commands.${name}.description`) || cmd.data.description;
      return `**/${name}** — ${description}`;
    })
    .join('\n');

  // Build reply content
  let content = `📖 ${t('commands.help.response') || 'Available commands'}\n\n`;
  if (userCommandsList) {
    content += `**User Commands:**\n${userCommandsList}\n\n`;
  }
  if (adminCommandsList) {
    content += `**Admin Commands:**\n${adminCommandsList}\n\n`;
  }

  // Reply with the list, ephemeral so only user sees it
  await interaction.reply({
    content,
    flags: MessageFlags.Ephemeral,
  });
}
