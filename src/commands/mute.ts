import {
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    SlashCommandBuilder,
    MessageFlags
} from 'discord.js';
import { t } from '../lib/i18n';

export const data = new SlashCommandBuilder()
    .setName('mute')
    .setDescription('commands.mute.description')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(option =>
        option
            .setName('user')
            .setDescription('commands.mute.options.user')
            .setRequired(true)
    )
    .addStringOption(option =>
        option
            .setName('reason')
            .setDescription('commands.mute.options.reason')
            .setRequired(false)
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') || t('commands.mute.no_reason');

    const member = interaction.guild?.members.cache.get(user.id);
    if (!member) {
        return interaction.reply({
            content: t('errors.user_not_found'),
            flags: MessageFlags.Ephemeral,
        });
    }

    if (!member.moderatable) {
        return interaction.reply({
            content: t('commands.mute.cannot_mute'),
            flags: MessageFlags.Ephemeral,
        });
    }

    try {
        await member.timeout(10 * 60 * 1000, reason);

        await interaction.reply({
            content: t('commands.mute.success', {
                user: user.tag,
                reason
            }),
            flags: MessageFlags.Ephemeral,
        });
    } catch (error) {
        console.error('[mute] Error:', error);
        await interaction.reply({
            content: t('errors.unexpected'),
            flags: MessageFlags.Ephemeral,
        });
    }
}
