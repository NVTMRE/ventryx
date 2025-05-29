import {
  Client,
  GuildMember,
  PermissionsBitField,
  EmbedBuilder,
} from 'discord.js';
import { db } from '../lib/db';
import { autoroles } from '../lib/db/schema';
import { eq } from 'drizzle-orm';
import { t } from '../lib/i18n';
import {embedColor} from "../config/embed-color";

export function register(client: Client) {
  console.log('[Event] guildMemberAdd listener registered');

  client.on('guildMemberAdd', async (member: GuildMember) => {
    const { user, guild } = member;

    process.env.DEBUG && console.log(`[guildMemberAdd] New member: ${user.tag} (${user.id}) joined guild: ${guild.name} (${guild.id})`);

    const systemChannel = guild.systemChannel;
    if (
        systemChannel &&
        systemChannel.viewable &&
        systemChannel.permissionsFor(guild.members.me!)?.has(PermissionsBitField.Flags.SendMessages)
    ) {
      try {
        const embed = new EmbedBuilder()
            .setTitle(t('events.welcome.embed.title', { guildName: guild.name }))
            .setDescription(t('events.welcome.embed.description', { userId: user.id }))
            .setColor(embedColor)
            .setThumbnail(user.avatarURL())
            .setTimestamp();

        await systemChannel.send({ embeds: [embed] });

        process.env.DEBUG && console.log(`[Welcome] Embed message sent in #${systemChannel.name}`);
      } catch (err) {
        console.error(`[Welcome] Failed to send embed message:`, err);
      }
    } else {
      process.env.DEBUG && console.log('[Welcome] System channel unavailable or no permission.');
    }

    const config = await db.query.autoroles.findFirst({
      where: eq(autoroles.guildId, guild.id),
    });

    if (!config) {
      process.env.DEBUG && console.log('[AutoRole] No autorole configured.');
      return;
    }

    const role = guild.roles.cache.get(config.roleId);
    if (!role) {
      process.env.DEBUG && console.log(`[AutoRole] Role ID ${config.roleId} not found.`);
      return;
    }

    try {
      await member.roles.add(role);
      process.env.DEBUG && console.log(`[AutoRole] Assigned role ${role.name} to ${user.tag}`);
    } catch (err) {
      console.error(`[AutoRole] Failed to assign role to ${user.tag}:`, err);
    }
  });
}
