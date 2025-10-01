// src/events/message-reaction-add.ts

import { Event } from "../types";
import { MessageReaction, User } from "discord.js";
import { db } from "../database/connection";
import { autoRoles } from "../database/schema";
import { and, eq } from "drizzle-orm";

const event: Event = {
  name: "messageReactionAdd",
  execute: async (reaction: MessageReaction, user: User) => {
    if (user.bot) return;
    if (reaction.partial) {
      try {
        await reaction.fetch();
      } catch (error) {
        return;
      }
    }

    const { message, emoji } = reaction;
    const guildId = message.guild?.id;
    if (!guildId) return;

    const emojiIdentifier = emoji.id ?? emoji.name;
    if (!emojiIdentifier) return;

    const config = await db.query.autoRoles.findFirst({
      where: and(
        eq(autoRoles.guildId, guildId),
        eq(autoRoles.messageId, message.id),
        eq(autoRoles.emoji, emojiIdentifier)
      ),
    });

    if (!config) return;

    try {
      const member = await message.guild!.members.fetch(user.id);
      const role = await message.guild!.roles.fetch(config.roleId);
      if (role && member) {
        await member.roles.add(role);
      }
    } catch (error) {
      console.error(
        `Nie udało się nadać roli ${config.roleId} użytkownikowi ${user.id}:`,
        error
      );
    }
  },
};

export default event;
