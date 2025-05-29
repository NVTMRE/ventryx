import {
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    SlashCommandBuilder,
    TextChannel,
    Role,
    MessageFlags,
    EmbedBuilder,
    Colors,
    ColorResolvable
} from 'discord.js';
import { t } from '../lib/i18n'; // Your i18n function
// Assuming embedColor is a 6-digit HEX string (without '#') from your config
import { embedColor as defaultEmbedColorHex } from "../config/embed-color";

export const data = new SlashCommandBuilder()
    .setName('announce')
    .setDescription(t('commands.announce.description'))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(option =>
        option.setName('channel')
            .setDescription(t('commands.announce.options.channel.description'))
            .addChannelTypes(0) // GUILD_TEXT channel type
            .setRequired(true))
    .addStringOption(option =>
        option.setName('message')
            .setDescription(t('commands.announce.options.message.description'))
            .setRequired(true)
            .setMaxLength(4000)) // Embed description limit
    .addRoleOption(option =>
        option.setName('mention_role')
            .setDescription(t('commands.announce.options.mention_role.description'))
            .setRequired(false))
    .addStringOption(option =>
        option.setName('title')
            .setDescription(t('commands.announce.options.title.description'))
            .setRequired(false)
            .setMaxLength(256)) // Embed title limit
    .addStringOption(option =>
        option.setName('color')
            .setDescription(t('commands.announce.options.color.description'))
            .setRequired(false)
            .addChoices(
                { name: 'Default (from config)', value: 'CONFIG_DEFAULT' },
                { name: 'Red', value: Colors.Red.toString() },
                { name: 'Green', value: Colors.Green.toString() },
                { name: 'Yellow', value: Colors.Yellow.toString() },
                { name: 'Blue (Discord Blue)', value: Colors.Blue.toString() },
                { name: 'Blurple (Discord Blurple)', value: Colors.Blurple.toString() },
                { name: 'Purple', value: Colors.Purple.toString() },
                { name: 'Gold', value: Colors.Gold.toString() },
                { name: 'Orange', value: Colors.Orange.toString() },
                { name: 'White', value: Colors.White.toString() }
            ));

export async function execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
        return interaction.reply({
            content: t('errors.guild_not_found'),
            flags: MessageFlags.Ephemeral,
        });
    }

    const targetChannel = interaction.options.getChannel('channel', true) as TextChannel;
    const messageContent = interaction.options.getString('message', true);
    const mentionRole = interaction.options.getRole('mention_role') as Role | null;
    const title = interaction.options.getString('title');
    const colorSelection = interaction.options.getString('color'); // Can be 'CONFIG_DEFAULT' or a numeric string

    // You can log the imported default color for debugging if needed:
    // console.log(`[AnnounceCommand] Imported defaultEmbedColorHex: "${defaultEmbedColorHex}"`);

    if (!targetChannel) {
        return interaction.reply({
            content: t('commands.announce.error_invalid_channel_type'),
            flags: MessageFlags.Ephemeral,
        });
    }

    const botPermissionsInChannel = targetChannel.permissionsFor(interaction.guild.members.me!);
    if (!botPermissionsInChannel || !botPermissionsInChannel.has(PermissionFlagsBits.SendMessages) || !botPermissionsInChannel.has(PermissionFlagsBits.EmbedLinks)) {
        return interaction.reply({
            content: t('commands.announce.error_bot_missing_perms_in_channel', { channel: targetChannel.toString() }),
            flags: MessageFlags.Ephemeral,
        });
    }

    const announcementEmbed = new EmbedBuilder()
        .setDescription(messageContent)
        .setTimestamp()
        .setFooter({ text: t('commands.announce.embed_footer', { user: interaction.user.tag }), iconURL: interaction.user.displayAvatarURL() });

    if (title) {
        announcementEmbed.setTitle(title);
    }

    let finalEmbedColor: ColorResolvable;
    let colorSourceInfo: string = "config default"; // For debugging

    // 1. Determine the color based on user selection or config default
    if (colorSelection && colorSelection !== 'CONFIG_DEFAULT') {
        // User selected a specific color from the list
        const parsedColor = parseInt(colorSelection, 10); // Values from choices are numeric strings
        if (!isNaN(parsedColor)) {
            finalEmbedColor = parsedColor;
            colorSourceInfo = `user selection (${colorSelection})`;
        } else {
            // This shouldn't happen if colorSelection comes from addChoices with numeric string values
            console.warn(`[AnnounceCommand] User selected color "${colorSelection}" is not a parsable number. Falling back to configured default.`);
            // Attempt to use configured default as a fallback
            if (defaultEmbedColorHex) {
                finalEmbedColor = `#${defaultEmbedColorHex}`;
                colorSourceInfo = "config default (fallback from invalid user selection)";
            } else {
                console.error(`[AnnounceCommand] Invalid defaultEmbedColorHex in config: "${defaultEmbedColorHex}" during fallback from invalid user selection. Must be 6-digit HEX. Defaulting to Blurple.`);
                finalEmbedColor = Colors.Blurple; // Ultimate fallback
                colorSourceInfo = "Discord Blurple (ultimate fallback after invalid user selection & invalid config)";
            }
        }
    } else {
        // User selected "CONFIG_DEFAULT" or did not select a color (colorSelection is null)
        // Prioritize the configured default color
        if (defaultEmbedColorHex) {
            finalEmbedColor = `#${defaultEmbedColorHex}`;
            // colorSourceInfo remains "config default"
        } else {
            console.error(`[AnnounceCommand] Invalid defaultEmbedColorHex in config: "${defaultEmbedColorHex}". Must be 6-digit HEX. Defaulting to Blurple.`);
            finalEmbedColor = Colors.Blurple; // Ultimate fallback
            colorSourceInfo = "Discord Blurple (fallback from invalid config default)";
        }
    }

    // For debugging purposes, you can uncomment this:
    // console.log(`[AnnounceCommand] Final color to be set: ${finalEmbedColor} (Source: ${colorSourceInfo})`);

    try {
        announcementEmbed.setColor(finalEmbedColor);
    } catch (e) {
        console.error(`[AnnounceCommand] Error setting color "${finalEmbedColor}" (Source: ${colorSourceInfo}):`, e);
        // If setColor fails even after validation, use an ultimate fallback
        announcementEmbed.setColor(Colors.Blurple);
        console.warn(`[AnnounceCommand] Fallback to Colors.Blurple due to error in setColor.`);
    }


    try {
        let messagePayload;
        if (mentionRole) {
            messagePayload = { content: `${mentionRole.toString()}`, embeds: [announcementEmbed] };
        } else {
            messagePayload = { embeds: [announcementEmbed] };
        }

        await targetChannel.send(messagePayload);

        return interaction.reply({
            content: t('commands.announce.success', { channel: targetChannel.toString() }),
            flags: MessageFlags.Ephemeral,
        });

    } catch (error) {
        console.error(`[AnnounceCommand] Error sending announcement to channel ${targetChannel.id}:`, error);
        return interaction.reply({
            content: t('errors.unexpected'),
            flags: MessageFlags.Ephemeral,
        });
    }
}