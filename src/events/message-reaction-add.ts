import {
  Client,
} from 'discord.js';
import { db } from '../lib/db';
import { autoroleReactions } from '../lib/db/schema';
import { eq, and } from 'drizzle-orm';

export function register(client: Client) {
  console.log('[Event] messageReactionAdd listener registered');

  client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot) return;

    try {
      if (reaction.partial) await reaction.fetch().catch(() => {});
      if (reaction.message?.partial) await reaction.message.fetch().catch(() => {});

      const message = reaction.message;
      if (!message.guildId) return;

      const emoji = reaction.emoji.id ?? reaction.emoji.name;
      if (!emoji) return;

      console.log("[reactionAdd] Reaction:", {
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
        console.log("[reactionAdd] No match in DB");
        return;
      }

      const guild = await client.guilds.fetch(message.guildId);
      const member = await guild.members.fetch(user.id);

      await member.roles.add(match.roleId);
      console.log(`[reactionAdd] Role ${match.roleId} added to ${user.tag}`);
    } catch (err) {
      console.error("[reactionAdd] Error:", err);
    }
  });
}
