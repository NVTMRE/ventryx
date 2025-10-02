import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionsBitField,
  TextChannel,
  ChannelType,
  ChatInputCommandInteraction,
} from "discord.js";
import { Command } from "../types";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Usuwa określoną liczbę wiadomości z kanału (max 100).")
    .addIntegerOption((option) =>
      option
        .setName("ilość")
        .setDescription("Liczba wiadomości do usunięcia (1-100)")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    )
    // Ogranicza widoczność komendy tylko dla osób z uprawnieniami
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageMessages),

  execute: async (interaction: ChatInputCommandInteraction) => {
    // Sprawdzenie, czy komenda jest używana na kanale tekstowym
    if (interaction.channel?.type !== ChannelType.GuildText) {
      await interaction.reply({
        content: "Tej komendy można używać tylko na kanałach tekstowych.",
        ephemeral: true,
      });
      return;
    }

    const amount = interaction.options.getInteger("ilość", true);

    try {
      // Odroczenie odpowiedzi, aby uniknąć timeoutu przy dłuższym działaniu
      await interaction.deferReply({ ephemeral: true });

      // Usunięcie wiadomości
      const deletedMessages = await (
        interaction.channel as TextChannel
      ).bulkDelete(amount, true);

      // Stworzenie embeda z potwierdzeniem
      const successEmbed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle("✅ Sukces!")
        .setDescription(
          `Pomyślnie usunięto **${deletedMessages.size}** wiadomości.`
        )
        .setFooter({
          text: `Komenda wywołana przez: ${interaction.user.tag}`,
          iconURL: interaction.user.displayAvatarURL(),
        });

      // Edycja odroczonej odpowiedzi
      await interaction.editReply({ embeds: [successEmbed] });
    } catch (error) {
      console.error(error);

      // Stworzenie embeda z informacją o błędzie
      const errorEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle("❌ Wystąpił błąd")
        .setDescription(
          "Nie udało się usunąć wiadomości. Może to być spowodowane brakiem uprawnień lub próbą usunięcia wiadomości starszych niż 14 dni."
        )
        .setFooter({
          text: "Ventryx Bot",
          iconURL: interaction.client.user?.displayAvatarURL(),
        });

      // Jeśli odpowiedź nie została jeszcze wysłana, wyślij nową. Jeśli była odroczona, edytuj ją.
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ embeds: [errorEmbed] });
      } else {
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      }
    }
  },
};

export default command;
