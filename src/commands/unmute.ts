import {
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    SlashCommandBuilder,
    MessageFlags
} from 'discord.js';
import { t } from '../lib/i18n';

export const data = new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('commands.unmute.description')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(option =>
        option
            .setName('user')
            .setDescription('commands.unmute.options.user')
            .setRequired(true)
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    const user = interaction.options.getUser('user', true);

    const member = interaction.guild?.members.cache.get(user.id);
    if (!member) {
        return interaction.reply({
            content: t('errors.user_not_found'),
            flags: MessageFlags.Ephemeral,
        });
    }

    if (!member.moderatable) {
        return interaction.reply({
            content: t('commands.unmute.cannot_unmute'),
            flags: MessageFlags.Ephemeral,
        });
    }

    try {
        await member.timeout(null); // Remove timeout (unmute)

        await interaction.reply({
            content: t('commands.unmute.success', {
                user: user.tag,
            }),
            flags: MessageFlags.Ephemeral,
        });
    } catch (error) {
        console.error('[unmute] Error:', error);
        await interaction.reply({
            content: t('errors.unexpected'),
            flags: MessageFlags.Ephemeral,
        });
    }
}
