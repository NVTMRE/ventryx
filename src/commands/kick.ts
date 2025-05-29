import {
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    SlashCommandBuilder,
    MessageFlags
} from 'discord.js';
import { t } from '../lib/i18n';

export const data = new SlashCommandBuilder()
    .setName('kick')
    .setDescription(t('commands.kick.description'))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(option =>
        option
            .setName('user')
            .setDescription(t('commands.kick.options.user'))
            .setRequired(true)
    )
    .addStringOption(option =>
        option
            .setName('reason')
            .setDescription(t('commands.kick.options.reason'))
            .setRequired(false)
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') || t('commands.kick.no_reason');

    const member = interaction.guild?.members.cache.get(user.id);
    if (!member) {
        return interaction.reply({ content: t('errors.user_not_found'), flags: MessageFlags.Ephemeral });
    }

    if (!member.kickable) {
        return interaction.reply({ content: t('commands.kick.cannot_kick'), flags: MessageFlags.Ephemeral });
    }

    try {
        await member.kick(reason);
        await interaction.reply({ content: t('commands.kick.success', { user: user.tag, reason }), flags: MessageFlags.Ephemeral });
    } catch (error) {
        console.error('[kick] Error:', error);
        await interaction.reply({ content: t('errors.unexpected'), flags: MessageFlags.Ephemeral });
    }
}
