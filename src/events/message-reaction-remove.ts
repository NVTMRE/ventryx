import { Client } from 'discord.js';
import { db } from '../lib/db';
import { autoroleReactions } from '../lib/db/schema';
import { eq, and } from 'drizzle-orm';

export function register(client: Client) {
  console.log('[Event] messageReactionRemove listener registered');

  client.on('messageReactionRemove', async (reaction, user) => {
    if (user.bot) return;

    try {
      if (reaction.partial) await reaction.fetch().catch(() => {
      });
      if (reaction.message?.partial) await reaction.message.fetch().catch(() => {
      });

      const message = reaction.message;
      if (!message.guildId) return;

      const emoji = reaction.emoji.id ?? reaction.emoji.name;
      if (!emoji) return;

      console.log("[reactionRemove] Reaction:", {
        messageId: message.id,
        guildId: message.guildId,
        emoji,
        user: user.id
      });

      const match = await db.select()
        .from(autoroleReactions)
        .where(and(
          eq(autoroleReactions.guildId, message.guildId),
          eq(autoroleReactions.messageId, message.id),
          eq(autoroleReactions.emoji, emoji)
        ))
        .then(r => r[0]);

      if (!match) {
        console.log("[reactionRemove] No match in DB");
        return;
      }

      const guild = await client.guilds.fetch(message.guildId);
      const member = await guild.members.fetch(user.id);

      await member.roles.remove(match.roleId);
      console.log(`[reactionRemove] Role ${match.roleId} removed from ${user.tag}`);
    } catch (err) {
      console.error("[reactionRemove] Error:", err);
    }
  });
}