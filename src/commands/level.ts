// src/commands/level.ts

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  User,
  AttachmentBuilder,
  PermissionFlagsBits,
  GuildMember,
} from "discord.js";
import { Command } from "../types";
import { XPManager } from "../managers/xp-manager";
import { LevelCalculator } from "../utils/level-calculator";
import { createCanvas, loadImage } from "@napi-rs/canvas";

// Funkcja do konwersji hex na RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 111, g: 0, b: 255 };
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("level")
    .setDescription("Sprawdź poziom i postęp XP")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("check")
        .setDescription("Sprawdź swój poziom lub poziom innego użytkownika")
        .addUserOption((option) =>
          option
            .setName("user")
            .setDescription("Użytkownik do sprawdzenia (tylko admin)")
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("leaderboard")
        .setDescription("Wyświetl ranking poziomów na serwerze")
        .addIntegerOption((option) =>
          option
            .setName("limit")
            .setDescription("Ile miejsc pokazać (max 25)")
            .setMinValue(5)
            .setMaxValue(25)
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("progression")
        .setDescription("Pokaż tabelę progresji poziomów")
        .addIntegerOption((option) =>
          option
            .setName("max_level")
            .setDescription("Do którego poziomu pokazać (max 100)")
            .setMinValue(10)
            .setMaxValue(100)
            .setRequired(false)
        )
    ),

  execute: async (interaction: ChatInputCommandInteraction) => {
    const subcommand = interaction.options.getSubcommand();
    const xpManager = XPManager.getInstance();

    if (subcommand === "check") {
      const requestedUser = interaction.options.getUser("user");
      const member = interaction.member as GuildMember;

      // Sprawdź czy ktoś próbuje zobaczyć statystyki innego użytkownika
      if (requestedUser && requestedUser.id !== interaction.user.id) {
        // Tylko admin może sprawdzać innych
        if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
          await interaction.reply({
            content:
              "❌ Tylko administratorzy mogą sprawdzać statystyki innych użytkowników!",
            ephemeral: true,
          });
          return;
        }
      }

      const targetUser = requestedUser || interaction.user;

      await interaction.deferReply();

      const stats = await xpManager.getUserStats(
        targetUser.id,
        interaction.guildId!
      );

      // Pobierz ranking użytkownika
      const leaderboard = await xpManager.getLeaderboard(
        interaction.guildId!,
        100
      );
      const userRank =
        leaderboard.findIndex((entry) => entry.userId === targetUser.id) + 1;

      // Pobierz kolor z .env
      const embedColor = process.env.EMBEDED_COLOR || "6f00ff";
      const rgb = hexToRgb(embedColor);

      // Stwórz canvas
      const canvas = createCanvas(600, 250);
      const ctx = canvas.getContext("2d");

      // Tło - ciemne z akcentem koloru z env
      const bgGradient = ctx.createLinearGradient(0, 0, 600, 250);
      bgGradient.addColorStop(0, "#1a1a1a");
      bgGradient.addColorStop(1, "#0d0d0d");
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, 600, 250);

      // Akcent w lewym górnym rogu (trójkąt) - kolor z env
      ctx.fillStyle = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(200, 0);
      ctx.lineTo(0, 80);
      ctx.closePath();
      ctx.fill();

      // Avatar
      try {
        const avatarURL = targetUser.displayAvatarURL({
          extension: "png",
          size: 128,
        });
        const avatar = await loadImage(avatarURL);

        // Rysuj okrągły avatar
        ctx.save();
        ctx.beginPath();
        ctx.arc(90, 90, 55, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatar, 35, 35, 110, 110);
        ctx.restore();

        // Obramowanie avatara - kolor z env
        ctx.strokeStyle = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(90, 90, 55, 0, Math.PI * 2);
        ctx.stroke();
      } catch (error) {
        console.error("Błąd ładowania avatara:", error);
        // Fallback - koło z inicjałem
        ctx.fillStyle = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
        ctx.beginPath();
        ctx.arc(90, 90, 55, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#FFFFFF";
        ctx.font = "bold 48px Arial";
        ctx.textAlign = "center";
        ctx.fillText(targetUser.username[0].toUpperCase(), 90, 105);
      }

      // Nazwa użytkownika
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 28px Arial";
      ctx.textAlign = "left";
      ctx.fillText(targetUser.username, 170, 75);

      // XP info
      ctx.fillStyle = "#AAAAAA";
      ctx.font = "18px Arial";
      ctx.fillText(`${stats.currentXP}XP/${stats.requiredXP}XP`, 170, 105);

      // Ranking i Level - prawy górny róg
      ctx.textAlign = "right";
      ctx.fillStyle = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
      ctx.font = "14px Arial";
      ctx.fillText("ranking", 575, 25);

      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 32px Arial";
      ctx.fillText(`#${userRank}`, 575, 55);

      ctx.fillStyle = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
      ctx.font = "14px Arial";
      ctx.fillText("level", 575, 90);

      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 32px Arial";
      ctx.fillText(`${stats.level}`, 575, 120);

      // Progress bar background
      const barX = 40;
      const barY = 160;
      const barWidth = 520;
      const barHeight = 35;

      // Tło paska
      ctx.fillStyle = "#2a2a2a";
      ctx.beginPath();
      ctx.roundRect(barX, barY, barWidth, barHeight, 17.5);
      ctx.fill();

      // Progress bar fill - kolor z env
      const progress = stats.progress / 100;
      const fillWidth = Math.max(barWidth * progress, 10);

      const progressGradient = ctx.createLinearGradient(
        barX,
        barY,
        barX + fillWidth,
        barY
      );
      progressGradient.addColorStop(0, `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`);
      progressGradient.addColorStop(
        1,
        `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.6)`
      );

      ctx.fillStyle = progressGradient;
      ctx.beginPath();
      ctx.roundRect(barX, barY, fillWidth, barHeight, 17.5);
      ctx.fill();

      // Procent na pasku
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 16px Arial";
      ctx.textAlign = "center";
      ctx.fillText(`${stats.progress.toFixed(1)}%`, 300, 183);

      // "Razem" label i total XP
      ctx.fillStyle = "#888888";
      ctx.font = "14px Arial";
      ctx.textAlign = "left";
      ctx.fillText(`Razem: ${stats.totalXP.toLocaleString()} XP`, 40, 220);

      // Do następnego poziomu
      const xpNeeded = stats.requiredXP - stats.currentXP;
      ctx.fillStyle = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
      ctx.font = "bold 14px Arial";
      ctx.textAlign = "right";
      ctx.fillText(`${xpNeeded} XP do poziomu ${stats.level + 1}`, 560, 220);

      // Konwertuj canvas do bufora
      const buffer = canvas.toBuffer("image/png");
      const attachment = new AttachmentBuilder(buffer, {
        name: "level-card.png",
      });

      await interaction.editReply({ files: [attachment] });
    } else if (subcommand === "leaderboard") {
      const limit = interaction.options.getInteger("limit") || 10;

      await interaction.deferReply();

      const leaderboard = await xpManager.getLeaderboard(
        interaction.guildId!,
        limit
      );

      if (leaderboard.length === 0) {
        await interaction.editReply({
          content: "Brak danych o poziomach na tym serwerze.",
        });
        return;
      }

      const leaderboardText = await Promise.all(
        leaderboard.map(async (entry, index) => {
          try {
            const user = await interaction.client.users.fetch(entry.userId);
            const medal =
              index === 0
                ? "🥇"
                : index === 1
                ? "🥈"
                : index === 2
                ? "🥉"
                : `${index + 1}.`;
            return `${medal} **${user.tag}** - Poziom ${entry.level} (${entry.totalXP} XP)`;
          } catch {
            return `${index + 1}. Nieznany użytkownik - Poziom ${
              entry.level
            } (${entry.totalXP} XP)`;
          }
        })
      );

      const embed = new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle(`🏆 Ranking Poziomów - ${interaction.guild!.name}`)
        .setDescription(leaderboardText.join("\n"))
        .setTimestamp()
        .setFooter({
          text: `Top ${limit} użytkowników`,
        });

      await interaction.editReply({ embeds: [embed] });
    } else if (subcommand === "progression") {
      const maxLevel = interaction.options.getInteger("max_level") || 30;

      await interaction.deferReply();

      const progressionTable =
        LevelCalculator.generateProgressionTable(maxLevel);

      const chunks: string[] = [];
      const lines = progressionTable.split("\n");
      let currentChunk = "```\n";

      for (const line of lines) {
        if (currentChunk.length + line.length + 5 > 1990) {
          currentChunk += "```";
          chunks.push(currentChunk);
          currentChunk = "```\n";
        }
        currentChunk += line + "\n";
      }
      currentChunk += "```";
      chunks.push(currentChunk);

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("📊 Tabela Progresji Poziomów")
        .setDescription(
          `Pokazuje wymaganą ilość XP dla poziomów 1-${maxLevel}\n\n${chunks[0]}`
        )
        .setTimestamp()
        .setFooter({
          text: "XP = Experience Points (Punkty Doświadczenia)",
        });

      await interaction.editReply({ embeds: [embed] });

      for (let i = 1; i < chunks.length; i++) {
        await interaction.followUp({
          content: chunks[i],
          ephemeral: true,
        });
      }
    }
  },
};

export default command;
