import { Worker, VentryxClient } from "../types";
import { XPManager } from "../managers/xp-manager";
import levelConfig from "../config/levels";
import { TextChannel, AttachmentBuilder } from "discord.js";
import { db } from "../database/connection";
import {
  levelConfig as levelConfigTable,
  levelRoles,
} from "../database/schema";
import { eq } from "drizzle-orm";
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

const worker: Worker = {
  name: "xp-flush",
  interval: levelConfig.batchUpdateInterval * 1000,

  execute: async () => {
    try {
      const xpManager = XPManager.getInstance();
      const result = await xpManager.flush();

      if (result.xpUpdates > 0 || result.voiceUpdates > 0) {
        console.log(
          `💾 XP Flush: ${result.xpUpdates} message updates, ${result.voiceUpdates} voice updates, ${result.levelUps.length} level ups`
        );
      }

      // Obsłuż level upy
      if (result.levelUps.length > 0) {
        const client = (global as any).__ventryxClient as VentryxClient;
        if (client) {
          for (const levelUp of result.levelUps) {
            await handleLevelUp(client, levelUp);
          }
        }
      }
    } catch (error) {
      console.error("❌ XP flush worker error:", error);
    }
  },
};

async function handleLevelUp(
  client: VentryxClient,
  levelUp: { userId: string; guildId: string; newLevel: number }
) {
  try {
    const guild = client.guilds.cache.get(levelUp.guildId);
    if (!guild) return;

    const member = await guild.members.fetch(levelUp.userId).catch(() => null);
    if (!member) return;

    // Pobierz konfigurację
    const configs = await db
      .select()
      .from(levelConfigTable)
      .where(eq(levelConfigTable.guildId, levelUp.guildId))
      .limit(1);

    const config = configs[0];
    if (!config || !config.enabled) return;

    // Przydziel role
    const roles = await db
      .select()
      .from(levelRoles)
      .where(eq(levelRoles.guildId, levelUp.guildId));

    for (const roleConfig of roles) {
      if (levelUp.newLevel >= roleConfig.requiredLevel) {
        const role = guild.roles.cache.get(roleConfig.roleId);
        if (role && !member.roles.cache.has(role.id)) {
          await member.roles.add(role).catch((err) => {
            console.error(`Failed to add role ${role.name}:`, err);
          });
        }
      } else {
        // Usuń rolę jeśli poziom jest za niski
        const role = guild.roles.cache.get(roleConfig.roleId);
        if (role && member.roles.cache.has(role.id)) {
          await member.roles.remove(role).catch((err) => {
            console.error(`Failed to remove role ${role.name}:`, err);
          });
        }
      }
    }

    // Wyślij wiadomość o awansie (canvas)
    let channel: TextChannel | null = null;

    if (config.levelUpChannel) {
      channel = guild.channels.cache.get(config.levelUpChannel) as TextChannel;
      console.log(`📢 Level up channel set: ${config.levelUpChannel}`);
    } else {
      console.log(
        `⚠️ No level up channel configured for guild ${levelUp.guildId}`
      );
      return; // Nie wysyłaj jeśli nie ma kanału
    }

    if (!channel) {
      console.error(
        `❌ Channel ${config.levelUpChannel} not found in guild ${guild.name}`
      );
      return;
    }

    if (channel && channel.isTextBased()) {
      console.log(
        `🎨 Creating level up canvas for ${member.user.tag} (Level ${levelUp.newLevel})`
      );

      // Pobierz kolor z .env
      const embedColor = process.env.EMBEDED_COLOR || "6f00ff";
      const rgb = hexToRgb(embedColor);

      // Stwórz canvas z gratulacjami
      const canvas = createCanvas(700, 200);
      const ctx = canvas.getContext("2d");

      // Tło - ciemne z gradientem
      const bgGradient = ctx.createLinearGradient(0, 0, 700, 200);
      bgGradient.addColorStop(0, "#1a1a1a");
      bgGradient.addColorStop(1, "#0d0d0d");
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, 700, 200);

      // Akcent w lewym górnym rogu (trójkąt)
      ctx.fillStyle = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(250, 0);
      ctx.lineTo(0, 100);
      ctx.closePath();
      ctx.fill();

      // Avatar użytkownika
      try {
        const avatarURL = member.user.displayAvatarURL({
          extension: "png",
          size: 128,
        });
        const avatar = await loadImage(avatarURL);

        // Rysuj okrągły avatar
        ctx.save();
        ctx.beginPath();
        ctx.arc(100, 100, 50, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatar, 50, 50, 100, 100);
        ctx.restore();

        // Obramowanie avatara
        ctx.strokeStyle = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(100, 100, 50, 0, Math.PI * 2);
        ctx.stroke();
      } catch (error) {
        console.error("Błąd ładowania avatara:", error);
        // Fallback - koło z inicjałem
        ctx.fillStyle = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
        ctx.beginPath();
        ctx.arc(100, 100, 50, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#FFFFFF";
        ctx.font = "bold 42px Arial";
        ctx.textAlign = "center";
        ctx.fillText(member.user.username[0].toUpperCase(), 100, 115);
      }

      // Główny tekst gratulacji
      ctx.textAlign = "left";
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 32px Arial";

      // Użyj custom message jeśli jest ustawiony
      let mainText = "GRATULACJE!";
      let subText = `Osiągnąłeś poziom ${levelUp.newLevel}!`;

      if (config.levelUpMessage) {
        // Parsuj custom message - usuń markdown i przetwórz \n
        let customMsg = config.levelUpMessage
          .replace(/\{user\}/g, member.user.username)
          .replace(/\{level\}/g, levelUp.newLevel.toString());

        console.log("📝 Original message:", customMsg);

        // Zamień różne warianty nowej linii na prawdziwy \n
        customMsg = customMsg
          .replace(/\\\\n/g, "\n") // \\n (podwójny escape)
          .replace(/\\n/g, "\n") // \n (literalny tekst)
          .replace(/\r\n/g, "\n") // Windows line ending
          .replace(/\r/g, "\n"); // Mac line ending

        console.log("📝 After newline processing:", customMsg);

        // Usuń markdown formatting dla canvas, ale zachowaj emoji w osobnej zmiennej
        let messageWithEmoji = customMsg; // Zachowaj oryginalny z emoji

        customMsg = customMsg
          .replace(/\*\*(.+?)\*\*/g, "$1") // **bold**
          .replace(/\*(.+?)\*/g, "$1") // *italic*
          .replace(/__(.+?)__/g, "$1") // __underline__
          .replace(/_(.+?)_/g, "$1") // _italic_
          .replace(/~~(.+?)~~/g, "$1") // ~~strikethrough~~
          .replace(/`(.+?)`/g, "$1"); // `code`

        // Usuń emoji z canvas (renderują się źle), ale zostaw w zmiennej
        const emojiRegex =
          /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
        customMsg = customMsg.replace(emojiRegex, "").trim();

        console.log("📝 After markdown removal:", customMsg);
        console.log("📝 Message with emoji:", messageWithEmoji);

        // Podziel na linie
        const lines = customMsg
          .split("\n")
          .filter((line) => line.trim().length > 0);

        console.log("📝 Lines:", lines);

        if (lines.length > 1) {
          mainText = lines[0] || "GRATULACJE!";
          subText = lines.slice(1).join(" ");
        } else if (customMsg.length <= 50) {
          mainText = customMsg;
          subText = "";
        } else {
          // Jeśli długi, podziel na dwie linie
          const words = customMsg.split(" ");
          const mid = Math.ceil(words.length / 2);
          mainText = words.slice(0, mid).join(" ");
          subText = words.slice(mid).join(" ");
        }
      }

      ctx.fillText(mainText, 180, 80);

      // Podtytuł
      if (subText) {
        ctx.fillStyle = "#AAAAAA";
        ctx.font = "22px Arial";
        ctx.fillText(subText, 180, 115);
      }

      // Duży numer poziomu po prawej
      ctx.textAlign = "right";
      ctx.fillStyle = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
      ctx.font = "bold 80px Arial";
      ctx.fillText(`${levelUp.newLevel}`, 660, 120);

      ctx.fillStyle = "#888888";
      ctx.font = "18px Arial";
      ctx.fillText("POZIOM", 660, 145);

      // Dekoracyjna linia na dole
      const lineGradient = ctx.createLinearGradient(50, 170, 650, 170);
      lineGradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
      lineGradient.addColorStop(0.5, `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`);
      lineGradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);

      ctx.strokeStyle = lineGradient;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(50, 170);
      ctx.lineTo(650, 170);
      ctx.stroke();

      // Konwertuj canvas do bufora
      const buffer = canvas.toBuffer("image/png");
      const attachment = new AttachmentBuilder(buffer, {
        name: "level-up.png",
      });

      await channel
        .send({
          content: `<@${levelUp.userId}>`,
          files: [attachment],
        })
        .then(() => {
          console.log(
            `✅ Level up canvas sent for ${member.user.tag} in ${guild.name}`
          );
        })
        .catch((error) => {
          console.error(`❌ Failed to send level up canvas:`, error);
        });
    }
  } catch (error) {
    console.error("Error handling level up:", error);
  }
}

export default worker;
