import {
  SlashCommandBuilder,
  CommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
} from "discord.js";
import { Command, VentryxClient } from "../types";
import { Loader } from "../utils/loader";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("reload")
    .setDescription("Przeładuj wszystkie moduły bota (tylko dla adminów)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  execute: async (interaction: CommandInteraction) => {
    if (
      !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
    ) {
      await interaction.reply({
        content: "❌ Nie masz uprawnień do wykonania tej komendy!",
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const client = interaction.client as VentryxClient;
      const loader = new Loader(client);

      for (const worker of client.workers.values()) {
        if (worker.intervalId) {
          clearInterval(worker.intervalId);
        }
      }

      client.commands.clear();
      client.workers.clear();

      const commands = await loader.loadCommands();
      const events = await loader.loadEvents();
      const workers = await loader.loadWorkers();

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle("🔄 Moduły przeładowane!")
        .addFields([
          {
            name: "📝 Komendy",
            value: `${commands.success}/${
              commands.success + commands.failed
            } załadowane\n${commands.items.join(", ") || "Brak"}`,
            inline: false,
          },
          {
            name: "📡 Eventy",
            value: `${events.success}/${
              events.success + events.failed
            } załadowane\n${events.items.join(", ") || "Brak"}`,
            inline: false,
          },
          {
            name: "⚙️ Workery",
            value: `${workers.success}/${
              workers.success + workers.failed
            } załadowane\n${workers.items.join(", ") || "Brak"}`,
            inline: false,
          },
        ])
        .setTimestamp()
        .setFooter({
          text: `Przeładowano przez ${interaction.user.tag}`,
          iconURL: interaction.user.displayAvatarURL(),
        });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("❌ Error in reload command:", error);
      await interaction.editReply({
        content: "❌ Wystąpił błąd podczas przeładowywania modułów!",
      });
    }
  },
};

export default command;
