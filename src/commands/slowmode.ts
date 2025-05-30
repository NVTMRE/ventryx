import {
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    SlashCommandBuilder,
    TextChannel,
    ChannelType, MessageFlags
} from 'discord.js';
import { t } from '../lib/i18n';

export const data = new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('commands.slowmode.description')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addIntegerOption(option =>
        option
            .setName('seconds')
            .setDescription('commands.slowmode.options.seconds')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(21600) // 6 hours
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    const seconds = interaction.options.getInteger('seconds', true);

    const channel = interaction.channel;

    if (
        !channel ||
        (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement)
    ) {
        return interaction.reply({
            content: t('errors.invalid_channel'),
            flags: MessageFlags.Ephemeral,
        });
    }

    try {
        await (channel as TextChannel).setRateLimitPerUser(seconds);
        await interaction.reply({
            content: t('commands.slowmode.success', {
                seconds: seconds.toString(),
                channel: `<#${channel.id}>`
            }),
            flags: MessageFlags.Ephemeral,
        });
    } catch (error) {
        console.error('[slowmode] Error:', error);
        await interaction.reply({
            content: t('errors.unexpected'),
            flags: MessageFlags.Ephemeral,
        });
    }
}
