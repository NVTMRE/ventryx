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
    .setDescription(t('commands.announce.description')) // This t() call happens at command registration
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

    const targetChannel = interaction.options.getChannel('channel', true) as TextChannel; // Stays as TextChannel
    const messageContent = interaction.options.getString('message', true);
    const mentionRole = interaction.options.getRole('mention_role') as Role | null;
    const title = interaction.options.getString('title');
    const colorSelection = interaction.options.getString('color');

    // Debugging the imported default color
    // process.env.DEBUG && console.log(`[AnnounceCommand] Imported defaultEmbedColorHex: "${defaultEmbedColorHex}" (Type: ${typeof defaultEmbedColorHex})`);

    // Check if targetChannel is indeed a TextChannel (even though addChannelTypes should filter)
    if (!targetChannel) { // Changed this condition
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

    const footerText = t('commands.announce.embed_footer', { user: interaction.user.tag });
    // process.env.DEBUG && console.log(`[AnnounceCommand] Resolved footer text: "${footerText}"`);

    const announcementEmbed = new EmbedBuilder()
        .setDescription(messageContent)
        .setTimestamp()
        .setFooter({ text: footerText, iconURL: interaction.user.displayAvatarURL() });

    if (title) {
        announcementEmbed.setTitle(title);
    }

    let finalEmbedColor: ColorResolvable;
    let colorSourceInfo: string = "config default";

    if (colorSelection && colorSelection !== 'CONFIG_DEFAULT') {
        const parsedColor = parseInt(colorSelection, 10);
        if (!isNaN(parsedColor)) {
            finalEmbedColor = parsedColor;
            colorSourceInfo = `user selection (${colorSelection})`;
        } else {
            console.warn(`[AnnounceCommand] User selected color "${colorSelection}" is not a parsable number. Falling back to configured default.`);
            if (defaultEmbedColorHex) {
                finalEmbedColor = `#${defaultEmbedColorHex}`;
                colorSourceInfo = "config default (fallback from invalid user selection)";
            } else {
                console.error(`[AnnounceCommand] Invalid defaultEmbedColorHex in config: "${defaultEmbedColorHex}" during fallback. Must be 6-digit HEX. Defaulting to Blurple.`);
                finalEmbedColor = Colors.Blurple;
                colorSourceInfo = "Discord Blurple (ultimate fallback)";
            }
        }
    } else {
        if (defaultEmbedColorHex) {
            finalEmbedColor = `#${defaultEmbedColorHex}`;
            // colorSourceInfo remains "config default"
        } else {
            console.error(`[AnnounceCommand] Invalid defaultEmbedColorHex in config: "${defaultEmbedColorHex}". Defaulting to Blurple.`);
            finalEmbedColor = Colors.Blurple;
            colorSourceInfo = "Discord Blurple (fallback from invalid config default)";
        }
    }

    process.env.DEBUG && console.log(`[AnnounceCommand] Final color to be set: ${finalEmbedColor} (Source: ${colorSourceInfo})`);

    try {
        announcementEmbed.setColor(finalEmbedColor);
    } catch (e) {
        console.error(`[AnnounceCommand] Error setting color "${finalEmbedColor}" (Source: ${colorSourceInfo}):`, e);
        announcementEmbed.setColor(Colors.Blurple);
        console.warn(`[AnnounceCommand] Fallback to Colors.Blurple due to error in setColor.`);
    }

    try {
        let messagePayload: { content?: string, embeds: EmbedBuilder[] } = { embeds: [announcementEmbed] };
        if (mentionRole) {
            messagePayload.content = `${mentionRole.toString()}`;
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