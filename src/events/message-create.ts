// src/events/message-create.ts

import { Event } from "../types";
import { Message } from "discord.js";
import { XPManager } from "../managers/xp-manager";

const event: Event = {
  name: "messageCreate",
  execute: async (message: Message) => {
    if (message.author.bot || !message.guild) return;
    if (message.content.startsWith("/")) return;

    try {
      const xpManager = XPManager.getInstance();
      await xpManager.addMessageXP(message.author.id, message.guild.id);
    } catch (error) {
      console.error("❌ Error adding XP:", error);
    }
  },
};

export default event;