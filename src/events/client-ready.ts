import { Event, VentryxClient } from "../types";
import { REST, Routes } from "discord.js";

const event: Event = {
  name: "clientReady",
  once: true,
  execute: async (client: VentryxClient) => {
    console.log(`🚀 ${client.user?.tag} is now online!`);
    console.log(
      `📊 Serving ${client.guilds.cache.size} guilds with ${client.users.cache.size} users`
    );

    try {
      const rest = new REST({ version: "10" }).setToken(
        process.env.DISCORD_TOKEN!
      );
      const commands = Array.from(client.commands.values()).map((cmd) =>
        cmd.data.toJSON()
      );

      if (process.env.GUILD_ID) {
        await rest.put(
          Routes.applicationGuildCommands(
            client.user!.id,
            process.env.GUILD_ID
          ),
          { body: commands }
        );
        console.log(
          `✅ Successfully deployed ${commands.length} commands to guild`
        );
      }
    } catch (error) {
      console.error("❌ Failed to deploy commands:", error);
    }

    client.user?.setPresence({
      status: "online",
      activities: [
        {
          name: "Ventryx | /help",
          type: 0,
        },
      ],
    });
  },
};

export default event;
