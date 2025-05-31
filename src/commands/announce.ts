import {
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    SlashCommandBuilder,
    TextChannel,
    Role,
    MessageFlags,
    EmbedBuilder,
    Colors,
    ColorResolvable,
    Attachment // Needed for image attachments
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
                { name: t('commands.announce.options.color.choices.config_default'), value: 'CONFIG_DEFAULT' },
                { name: t('commands.announce.options.color.choices.red'), value: Colors.Red.toString() },
                { name: t('commands.announce.options.color.choices.green'), value: Colors.Green.toString() },
                { name: t('commands.announce.options.color.choices.yellow'), value: Colors.Yellow.toString() },
                { name: t('commands.announce.options.color.choices.blue'), value: Colors.Blue.toString() },
                { name: t('commands.announce.options.color.choices.blurple'), value: Colors.Blurple.toString() },
                { name: t('commands.announce.options.color.choices.purple'), value: Colors.Purple.toString() },
                { name: t('commands.announce.options.color.choices.gold'), value: Colors.Gold.toString() },
                { name: t('commands.announce.options.color.choices.orange'), value: Colors.Orange.toString() },
                { name: t('commands.announce.options.color.choices.white'), value: Colors.White.toString() }
            ))
    .addAttachmentOption(option => // New option for image
        option.setName('image')
            .setDescription(t('commands.announce.options.image.description'))
            .setRequired(false)
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
        return interaction.reply({
            content: t('errors.guild_not_found'),
            flags: MessageFlags.Ephemeral,
        });
    }

    const targetChannel = interaction.options.getChannel('channel', true) as TextChannel;
    const rawMessageContent = interaction.options.getString('message', true);
    const mentionRole = interaction.options.getRole('mention_role') as Role | null;
    const title = interaction.options.getString('title');
    const colorSelection = interaction.options.getString('color');
    const imageAttachment = interaction.options.getAttachment('image') as Attachment | null; // Get the image attachment

    // Replace literal '\\n' with actual newline character '\n'
    const messageContent = rawMessageContent.replace(/\\n/g, '\n');

    // You can log the imported default color for debugging if needed:
    console.log(`[AnnounceCommand] Imported defaultEmbedColorHex: "${defaultEmbedColorHex}"`);

    if (!targetChannel) { // Should not happen due to .setRequired(true) and addChannelTypes, but good for type safety
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
        .setFooter({ text: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() });

    if (title) {
        announcementEmbed.setTitle(title);
    }

    if (imageAttachment) { // Set the image in the embed if provided
        // Optional: Add a check for image content type if desired
        // if (imageAttachment.contentType?.startsWith('image/')) {
        announcementEmbed.setImage(imageAttachment.url);
        // } else {
        //     console.warn(`[AnnounceCommand] User provided an attachment that is not an image: ${imageAttachment.contentType}`);
        //     // Optionally reply to the user that the attachment was not an image
        // }
    }

    let finalEmbedColor: ColorResolvable;
    let colorSourceInfo: string = "config default"; // For debugging

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
                console.error(`[AnnounceCommand] Invalid defaultEmbedColorHex in config: "${defaultEmbedColorHex}" during fallback from invalid user selection. Must be 6-digit HEX. Defaulting to Blurple.`);
                finalEmbedColor = Colors.Blurple;
                colorSourceInfo = "Discord Blurple (ultimate fallback after invalid user selection & invalid config)";
            }
        }
    } else {
        if (defaultEmbedColorHex) {
            finalEmbedColor = `#${defaultEmbedColorHex}`;
        } else {
            console.error(`[AnnounceCommand] Invalid defaultEmbedColorHex in config: "${defaultEmbedColorHex}". Must be 6-digit HEX. Defaulting to Blurple.`);
            finalEmbedColor = Colors.Blurple;
            colorSourceInfo = "Discord Blurple (fallback from invalid config default)";
        }
    }

    // For debugging purposes, you can uncomment this:
    // console.log(`[AnnounceCommand] Final color to be set: ${finalEmbedColor} (Source: ${colorSourceInfo})`);

    try {
        announcementEmbed.setColor(finalEmbedColor);
    } catch (e) {
        console.error(`[AnnounceCommand] Error setting color "${finalEmbedColor}" (Source: ${colorSourceInfo}):`, e);
        announcementEmbed.setColor(Colors.Blurple); // Ultimate fallback for color
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