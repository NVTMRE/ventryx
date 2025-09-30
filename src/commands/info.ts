import {
  SlashCommandBuilder,
  CommandInteraction,
  EmbedBuilder,
  version as djsVersion,
} from "discord.js";
import { Command } from "../types";
import { db } from "../database/connection";
import { count } from "drizzle-orm";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("info")
    .setDescription("Wyświetl informacje o bocie"),

  execute: async (interaction: CommandInteraction) => {
    await interaction.deferReply();

    try {
      // Informacje o systemie
      const uptime = process.uptime();
      const uptimeString = new Date(uptime * 1000).toISOString().substr(11, 8);

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("🤖 Informacje o Ventryx Bot")
        .setThumbnail(interaction.client.user?.displayAvatarURL() || null)
        .addFields([
          {
            name: "📊 Statystyki",
            value: `**Serwery:** ${interaction.client.guilds.cache.size}\n**Użytkownicy w cache:** ${interaction.client.users.cache.size}\n`,
            inline: true,
          },
          {
            name: "⚙️ System",
            value: `**Uptime:** ${uptimeString}\n**Node.js:** ${process.version}\n**Discord.js:** v${djsVersion}`,
            inline: true,
          },
          {
            name: "💾 Pamięć",
            value: `**Używana:** ${Math.round(
              process.memoryUsage().heapUsed / 1024 / 1024
            )} MB\n**Całkowita:** ${Math.round(
              process.memoryUsage().heapTotal / 1024 / 1024
            )} MB`,
            inline: true,
          },
          {
            name: "👨‍💻 Developer",
            value: "NVTMRE (Ksawier Malkiewicz)",
            inline: false,
          },
        ])
        .setTimestamp()
        .setFooter({
          text: "Ventryx Bot | Made with ❤️ and TypeScript",
          iconURL: interaction.client.user?.displayAvatarURL(),
        });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("❌ Error in info command:", error);
      await interaction.editReply({
        content: "Wystąpił błąd podczas pobierania informacji!",
      });
    }
  },
};

export default command;
