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

    const configs = await db
      .select()
      .from(levelConfigTable)
      .where(eq(levelConfigTable.guildId, levelUp.guildId))
      .limit(1);

    const config = configs[0];
    if (!config || !config.enabled) return;

    // ZAKTUALIZOWANE ZARZĄDZANIE ROLAMI - ZAKRESY POZIOMÓW
    const roleConfigs = await db
      .select()
      .from(levelRoles)
      .where(eq(levelRoles.guildId, levelUp.guildId));

    if (roleConfigs.length > 0) {
      // Najpierw usuń wszystkie role z systemu poziomów
      for (const roleConfig of roleConfigs) {
        const role = guild.roles.cache.get(roleConfig.roleId);
        if (role && member.roles.cache.has(role.id)) {
          await member.roles.remove(role).catch((err) => {
            console.error(`Failed to remove role ${role.name}:`, err);
          });
        }
      }

      // Następnie dodaj odpowiednie role dla aktualnego poziomu
      for (const roleConfig of roleConfigs) {
        if (
          levelUp.newLevel >= roleConfig.minLevel &&
          levelUp.newLevel <= roleConfig.maxLevel
        ) {
          const role = guild.roles.cache.get(roleConfig.roleId);
          if (role && !member.roles.cache.has(role.id)) {
            await member.roles.add(role).catch((err) => {
              console.error(`Failed to add role ${role.name}:`, err);
            });
            console.log(
              `✅ Added role ${role.name} to ${member.user.tag} (Level ${levelUp.newLevel})`
            );
          }
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
      return;
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

      const embedColor = process.env.EMBEDED_COLOR || "6f00ff";
      const rgb = hexToRgb(embedColor);

      const canvas = createCanvas(700, 200);
      const ctx = canvas.getContext("2d");

      const bgGradient = ctx.createLinearGradient(0, 0, 700, 200);
      bgGradient.addColorStop(0, "#1a1a1a");
      bgGradient.addColorStop(1, "#0d0d0d");
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, 700, 200);

      ctx.fillStyle = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(250, 0);
      ctx.lineTo(0, 100);
      ctx.closePath();
      ctx.fill();

      try {
        const avatarURL = member.user.displayAvatarURL({
          extension: "png",
          size: 128,
        });
        const avatar = await loadImage(avatarURL);

        ctx.save();
        ctx.beginPath();
        ctx.arc(100, 100, 50, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatar, 50, 50, 100, 100);
        ctx.restore();

        ctx.strokeStyle = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(100, 100, 50, 0, Math.PI * 2);
        ctx.stroke();
      } catch (error) {
        console.error("Błąd ładowania avatara:", error);
        ctx.fillStyle = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
        ctx.beginPath();
        ctx.arc(100, 100, 50, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#FFFFFF";
        ctx.font = "bold 42px Arial";
        ctx.textAlign = "center";
        ctx.fillText(member.user.username[0].toUpperCase(), 100, 115);
      }

      ctx.textAlign = "left";
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 32px Arial";

      let mainText = "GRATULACJE!";
      let subText = `Osiągnąłeś poziom ${levelUp.newLevel}!`;

      if (config.levelUpMessage) {
        let customMsg = config.levelUpMessage
          .replace(/\{user\}/g, member.user.username)
          .replace(/\{level\}/g, levelUp.newLevel.toString());

        console.log("📝 Original message:", customMsg);

        customMsg = customMsg
          .replace(/\\\\n/g, "\n")
          .replace(/\\n/g, "\n")
          .replace(/\r\n/g, "\n")
          .replace(/\r/g, "\n");

        console.log("📝 After newline processing:", customMsg);

        let messageWithEmoji = customMsg;

        customMsg = customMsg
          .replace(/\*\*(.+?)\*\*/g, "$1")
          .replace(/\*(.+?)\*/g, "$1")
          .replace(/__(.+?)__/g, "$1")
          .replace(/_(.+?)_/g, "$1")
          .replace(/~~(.+?)~~/g, "$1")
          .replace(/`(.+?)`/g, "$1");

        const emojiRegex =
          /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
        customMsg = customMsg.replace(emojiRegex, "").trim();

        console.log("📝 After markdown removal:", customMsg);
        console.log("📝 Message with emoji:", messageWithEmoji);

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
          const words = customMsg.split(" ");
          const mid = Math.ceil(words.length / 2);
          mainText = words.slice(0, mid).join(" ");
          subText = words.slice(mid).join(" ");
        }
      }

      ctx.fillText(mainText, 180, 80);

      if (subText) {
        ctx.fillStyle = "#AAAAAA";
        ctx.font = "22px Arial";
        ctx.fillText(subText, 180, 115);
      }

      ctx.textAlign = "right";
      ctx.fillStyle = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
      ctx.font = "bold 80px Arial";
      ctx.fillText(`${levelUp.newLevel}`, 660, 120);

      ctx.fillStyle = "#888888";
      ctx.font = "18px Arial";
      ctx.fillText("POZIOM", 660, 145);

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
