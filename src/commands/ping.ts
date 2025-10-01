import {
  SlashCommandBuilder,
  CommandInteraction,
  EmbedBuilder,
} from "discord.js";
import { Command } from "../types";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Sprawdź ping bota i opóźnienie API"),

  execute: async (interaction: CommandInteraction) => {
    const sent = await interaction.reply({
      content: "Pinging...",
      fetchReply: true,
    });

    const botLatency = sent.createdTimestamp - interaction.createdTimestamp;
    const apiLatency = Math.round(interaction.client.ws.ping);

    const embed = new EmbedBuilder()
      .setColor(
        apiLatency > 200 ? 0xff0000 : apiLatency > 100 ? 0xffff00 : 0x00ff00
      )
      .setTitle("🏓 Pong!")
      .addFields([
        { name: "🤖 Opóźnienie Bota", value: `${botLatency}ms`, inline: true },
        { name: "📡 Opóźnienie API", value: `${apiLatency}ms`, inline: true },
        {
          name: "📊 Status",
          value:
            apiLatency > 200
              ? "🔴 Wolno"
              : apiLatency > 100
              ? "🟡 Średnio"
              : "🟢 Szybko",
          inline: true,
        },
      ])
      .setTimestamp()
      .setFooter({
        text: "Ventryx Bot",
        iconURL: interaction.client.user?.displayAvatarURL(),
      });

    await interaction.editReply({
      content: null,
      embeds: [embed],
    });
  },
};

export default command;
