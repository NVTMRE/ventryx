import {
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    SlashCommandBuilder,
    MessageFlags, EmbedBuilder
} from 'discord.js';
import { t } from '../lib/i18n';

export const data = new SlashCommandBuilder()
    .setName('ban')
    .setDescription(t('commands.ban.description'))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(option =>
        option
            .setName('user')
            .setDescription(t('commands.ban.options.user'))
            .setRequired(true)
    )
    .addStringOption(option =>
        option
            .setName('reason')
            .setDescription(t('commands.ban.options.reason'))
            .setRequired(false)
    )
    .addIntegerOption(option =>
        option
            .setName('days')
            .setDescription(t('commands.ban.options.days'))
            .setMinValue(0)
            .setMaxValue(7)
            .setRequired(false)
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild;

    if (!guild) {
        return interaction.reply({
            content: t('errors.guild_not_found'),
            flags: MessageFlags.Ephemeral,
        });
    }

    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') || t('commands.ban.no_reason');
    const days = interaction.options.getInteger('days') ?? 0;

    if (days < 0 || days > 7) {
        return interaction.reply({
            content: t('commands.ban.invalid_days'),
            flags: MessageFlags.Ephemeral,
        });
    }

    const member = guild.members.cache.get(user.id);
    if (!member) {
        return interaction.reply({
            content: t('errors.user_not_found'),
            flags: MessageFlags.Ephemeral,
        });
    }

    if (!member.bannable) {
        return interaction.reply({
            content: t('commands.ban.cannot_ban'),
            flags: MessageFlags.Ephemeral,
        });
    }

    // Wyślij DM przed banem
    const embed = new EmbedBuilder()
        .setTitle(t('commands.ban.dm.title'))
        .setDescription(t('commands.ban.dm.description', { guild: guild.name, reason }))
        .setColor(0xff0000)
        .setTimestamp();

    try {
        await user.send({ embeds: [embed] });
    } catch {
        // Jeśli użytkownik ma wyłączone DM, zignoruj
    }

    try {
        await member.ban({ deleteMessageDays: days, reason });
        await interaction.reply({
            content: t('commands.ban.success', { user: user.tag, reason }),
            flags: MessageFlags.Ephemeral,
        });
    } catch (error) {
        console.error('[ban] Error:', error);
        await interaction.reply({
            content: t('errors.unexpected'),
            flags: MessageFlags.Ephemeral,
        });
    }
}