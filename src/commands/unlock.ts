import {
    ChatInputCommandInteraction, MessageFlags,
    PermissionFlagsBits,
    SlashCommandBuilder,
    TextChannel,
} from 'discord.js';
import { t } from '../lib/i18n';

export const data = new SlashCommandBuilder()
    .setName('unlock')
    .setDescription(t('commands.unlock.description'))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.channel || !(interaction.channel instanceof TextChannel)) {
        return interaction.reply({
            content: t('errors.invalid_channel'),
            flags: MessageFlags.Ephemeral,
        });
    }

    const channel = interaction.channel;
    const everyoneRole = interaction.guild?.roles.everyone;

    if (!everyoneRole) {
        return interaction.reply({
            content: t('errors.missing_everyone'),
            flags: MessageFlags.Ephemeral,
        });
    }

    try {
        await channel.permissionOverwrites.edit(everyoneRole, {
            SendMessages: true,
        });

        return interaction.reply({
            content: t('commands.unlock.success', { channel: `<#${channel.id}>` }),
            flags: MessageFlags.Ephemeral,
        });
    } catch (error) {
        console.error('Error unlocking channel:', error);
        return interaction.reply({
            content: t('errors.unexpected'),
            flags: MessageFlags.Ephemeral,
        });
    }
}