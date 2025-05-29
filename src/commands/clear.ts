import {
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    SlashCommandBuilder,
    TextChannel,
    ChannelType,
    MessageFlags
} from 'discord.js';
import { t } from '../lib/i18n';

export const data = new SlashCommandBuilder()
    .setName('clear')
    .setDescription('commands.clear.description')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addIntegerOption(option =>
        option
            .setName('amount')
            .setDescription('commands.clear.options.amount')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(100)
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    const amount = interaction.options.getInteger('amount', true);

    const channel = interaction.channel;

    if (!channel || (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement)) {
        return interaction.reply({
            content: t('errors.invalid_channel'),
            flags: MessageFlags.Ephemeral,
        });
    }

    try {
        const fetchedMessages = await (channel as TextChannel).messages.fetch({ limit: amount });
        await (channel as TextChannel).bulkDelete(fetchedMessages, true);

        await interaction.reply({
            content: t('commands.clear.success', {
                amount: toString(),
                channel: `<#${channel.id}>`
            }),
            flags: MessageFlags.Ephemeral,
        });
    } catch (error) {
        console.error('[clear] Error:', error);
        await interaction.reply({
            content: t('errors.unexpected'),
            flags: MessageFlags.Ephemeral,
        });
    }
}
