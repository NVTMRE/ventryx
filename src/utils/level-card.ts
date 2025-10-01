import { createCanvas, loadImage, registerFont } from "canvas";
import { User } from "discord.js";
import { LevelCalculator } from "./level-calculator";

export class LevelCardGenerator {
  /**
   * Generuje obrazek karty poziomu użytkownika
   */
  static async generateCard(
    user: User,
    level: number,
    currentXP: number,
    rank: number,
    accentColor: string = "6f00ff"
  ): Promise<Buffer> {
    // Tworzenie canvas
    const canvas = createCanvas(800, 250);
    const ctx = canvas.getContext("2d");

    // Konwersja hex na RGB
    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})/i.exec(hex);
      return result
        ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16),
          }
        : { r: 111, g: 0, b: 255 };
    };

    const color = hexToRgb(accentColor);

    // Tło - ciemny gradient
    const bgGradient = ctx.createLinearGradient(0, 0, 800, 250);
    bgGradient.addColorStop(0, "#1a1a1a");
    bgGradient.addColorStop(1, "#0d0d0d");
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, 800, 250);

    // Dekoracyjny element - ukośna linia z kolorem accentowym
    ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.15)`;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(300, 0);
    ctx.lineTo(400, 250);
    ctx.lineTo(0, 250);
    ctx.closePath();
    ctx.fill();

    // Ramka główna
    ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.3)`;
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 10, 780, 230);

    // Avatar - okrągły z obramowaniem
    try {
      const avatarURL = user.displayAvatarURL({ extension: "png", size: 256 });
      const avatar = await loadImage(avatarURL);

      // Cień avatara
      ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
      ctx.shadowBlur = 15;
      ctx.shadowOffsetX = 5;
      ctx.shadowOffsetY = 5;

      // Rysuj okrągły avatar
      ctx.save();
      ctx.beginPath();
      ctx.arc(110, 125, 70, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatar, 40, 55, 140, 140);
      ctx.restore();

      // Reset cienia
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      // Obramowanie avatara
      ctx.strokeStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(110, 125, 73, 0, Math.PI * 2);
      ctx.stroke();
    } catch (error) {
      console.error("Failed to load avatar:", error);
      // Fallback - prostokąt zamiast avatara
      ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
      ctx.fillRect(40, 55, 140, 140);
    }

    // Username
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 32px Arial";
    ctx.fillText(user.username, 210, 80);

    // Ranking i Level - w prawym górnym rogu
    const xpForNextLevel = LevelCalculator.getXPForNextLevel(level);
    const xpForCurrentLevel = LevelCalculator.getTotalXPForLevel(level);
    const xpInCurrentLevel = currentXP - xpForCurrentLevel;
    const progress = LevelCalculator.getProgressToNextLevel(currentXP, level);

    // Ranking
    ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
    ctx.font = "bold 48px Arial";
    ctx.textAlign = "right";
    ctx.fillText(`#${rank}`, 760, 60);

    ctx.fillStyle = "#888888";
    ctx.font = "18px Arial";
    ctx.fillText("ranking", 760, 80);

    // Level
    ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
    ctx.font = "bold 48px Arial";
    ctx.fillText(`${level}`, 760, 130);

    ctx.fillStyle = "#888888";
    ctx.font = "18px Arial";
    ctx.fillText("level", 760, 150);

    // Progress bar - tło
    const barX = 210;
    const barY = 170;
    const barWidth = 540;
    const barHeight = 30;

    ctx.fillStyle = "#2a2a2a";
    ctx.fillRect(barX, barY, barWidth, barHeight);

    // Progress bar - postęp z gradientem
    const progressGradient = ctx.createLinearGradient(
      barX,
      barY,
      barX + barWidth * progress,
      barY
    );
    progressGradient.addColorStop(0, `rgb(${color.r}, ${color.g}, ${color.b})`);
    progressGradient.addColorStop(
      1,
      `rgba(${color.r}, ${color.g}, ${color.b}, 0.6)`
    );

    ctx.fillStyle = progressGradient;
    ctx.fillRect(barX, barY, barWidth * progress, barHeight);

    // Obramowanie progress bara
    ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.5)`;
    ctx.lineWidth = 2;
    ctx.strokeRect(barX, barY, barWidth, barHeight);

    // XP Text - nad paskiem
    ctx.textAlign = "left";
    ctx.fillStyle = "#ffffff";
    ctx.font = "20px Arial";
    ctx.fillText(`${xpInCurrentLevel}XP/${xpForNextLevel}XP`, barX, barY - 10);

    // Total XP - pod paskiem
    ctx.fillStyle = "#888888";
    ctx.font = "16px Arial";
    ctx.fillText(
      `Razem: ${currentXP.toLocaleString()} XP`,
      barX,
      barY + barHeight + 20
    );

    return canvas.toBuffer("image/png");
  }

  /**
   * Generuje prosty obrazek dla leaderboardu (mniejszy)
   */
  static async generateMiniCard(
    user: User,
    level: number,
    xp: number,
    rank: number,
    accentColor: string = "6f00ff"
  ): Promise<Buffer> {
    const canvas = createCanvas(600, 100);
    const ctx = canvas.getContext("2d");

    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})/i.exec(hex);
      return result
        ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16),
          }
        : { r: 111, g: 0, b: 255 };
    };

    const color = hexToRgb(accentColor);

    // Tło
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, 600, 100);

    // Avatar
    try {
      const avatarURL = user.displayAvatarURL({ extension: "png", size: 128 });
      const avatar = await loadImage(avatarURL);

      ctx.save();
      ctx.beginPath();
      ctx.arc(50, 50, 30, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatar, 20, 20, 60, 60);
      ctx.restore();

      ctx.strokeStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(50, 50, 32, 0, Math.PI * 2);
      ctx.stroke();
    } catch (error) {
      ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
      ctx.fillRect(20, 20, 60, 60);
    }

    // Rank
    ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
    ctx.font = "bold 24px Arial";
    ctx.textAlign = "left";
    ctx.fillText(`#${rank}`, 100, 35);

    // Username
    ctx.fillStyle = "#ffffff";
    ctx.font = "20px Arial";
    ctx.fillText(user.username, 100, 60);

    // Level i XP
    ctx.fillStyle = "#888888";
    ctx.font = "16px Arial";
    ctx.fillText(`Level ${level} • ${xp.toLocaleString()} XP`, 100, 80);

    return canvas.toBuffer("image/png");
  }
}
