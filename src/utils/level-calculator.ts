// src/utils/level-calculator.ts

import levelConfig from "../config/levels";

export interface LevelConfig {
  baseXP: number;
  initialMultiplier: number;
  minMultiplier: number;
  multiplierDecayRate: number;
  decayThresholds: Array<{ level: number; multiplier: number }>;
}

export const DEFAULT_LEVEL_CONFIG: LevelConfig = {
  baseXP: 100,
  initialMultiplier: 1.5,
  minMultiplier: 1.15,
  multiplierDecayRate: 0.1,
  decayThresholds: [
    { level: 1, multiplier: 1.5 },
    { level: 11, multiplier: 1.4 },
    { level: 26, multiplier: 1.3 },
    { level: 51, multiplier: 1.2 },
    { level: 101, multiplier: 1.15 },
  ],
};

export class LevelCalculator {
  private static config: LevelConfig = DEFAULT_LEVEL_CONFIG;
  private static xpCache: Map<number, number> = new Map();

  private static getMultiplierForLevel(level: number): number {
    const thresholds = [...this.config.decayThresholds].reverse();
    for (const threshold of thresholds) {
      if (level >= threshold.level) {
        return threshold.multiplier;
      }
    }
    return this.config.initialMultiplier;
  }

  static getXPForLevel(level: number): number {
    if (level <= 1) return 0;
    if (level === 2) return this.config.baseXP;

    if (this.xpCache.has(level)) {
      return this.xpCache.get(level)!;
    }

    const previousXP = this.getXPForLevel(level - 1);
    const multiplier = this.getMultiplierForLevel(level - 1);
    const currentXP = Math.floor(previousXP * multiplier);

    this.xpCache.set(level, currentXP);
    return currentXP;
  }

  static getTotalXPForLevel(level: number): number {
    let total = 0;
    for (let i = 2; i <= level; i++) {
      total += this.getXPForLevel(i);
    }
    return total;
  }

  static getXPForNextLevel(currentLevel: number): number {
    return this.getXPForLevel(currentLevel + 1);
  }

  static calculateLevel(totalXP: number): number {
    let level = 1;
    let accumulatedXP = 0;

    while (true) {
      const xpForNextLevel = this.getXPForLevel(level + 1);
      if (accumulatedXP + xpForNextLevel > totalXP) {
        break;
      }
      accumulatedXP += xpForNextLevel;
      level++;
    }

    return level;
  }

  static checkLevelUp(oldXP: number, newXP: number): number | null {
    const oldLevel = this.calculateLevel(oldXP);
    const newLevel = this.calculateLevel(newXP);
    return newLevel > oldLevel ? newLevel : null;
  }

  static getProgressToNextLevel(totalXP: number, currentLevel: number): number {
    const xpForCurrentLevel = this.getTotalXPForLevel(currentLevel);
    const xpForNextLevel = this.getTotalXPForLevel(currentLevel + 1);
    const xpInCurrentLevel = totalXP - xpForCurrentLevel;
    const xpNeededForLevel = xpForNextLevel - xpForCurrentLevel;

    return Math.min(xpInCurrentLevel / xpNeededForLevel, 1);
  }

  static getRandomXP(base: number, variance: number): number {
    return base + Math.floor(Math.random() * (variance * 2 + 1)) - variance;
  }

  static calculateVoiceXP(minutes: number, xpPerMinute: number): number {
    let totalXP = 0;
    let remainingMinutes = minutes;

    for (const tier of levelConfig.voiceXPMultipliers) {
      const minutesInTier = Math.min(
        remainingMinutes,
        tier.maxMinutes - tier.minMinutes
      );

      if (minutesInTier <= 0) break;

      totalXP += Math.floor(minutesInTier * xpPerMinute * tier.multiplier);
      remainingMinutes -= minutesInTier;

      if (remainingMinutes <= 0) break;
    }

    return totalXP;
  }

  static generateProgressionTable(maxLevel: number = 50): string {
    let table = "Poziom | XP do następnego | Całkowite XP | Mnożnik\n";
    table += "-------|------------------|--------------|--------\n";

    let totalXP = 0;
    for (let i = 1; i <= maxLevel; i++) {
      const xpForNext = this.getXPForLevel(i + 1);
      totalXP += i > 1 ? this.getXPForLevel(i) : 0;
      const multiplier = this.getMultiplierForLevel(i);

      table += `${i.toString().padStart(6)} | ${xpForNext
        .toString()
        .padStart(16)} | ${totalXP
        .toString()
        .padStart(12)} | ${multiplier.toFixed(2)}\n`;
    }

    return table;
  }

  static getLevelFromXP(totalXP: number): {
    level: number;
    currentXP: number;
    requiredXP: number;
    progress: number;
  } {
    const level = this.calculateLevel(totalXP);
    const xpForCurrentLevel = this.getTotalXPForLevel(level);
    const xpForNextLevel = this.getTotalXPForLevel(level + 1);
    const currentXP = totalXP - xpForCurrentLevel;
    const requiredXP = xpForNextLevel - xpForCurrentLevel;
    const progress = requiredXP > 0 ? (currentXP / requiredXP) * 100 : 0;

    return {
      level,
      currentXP,
      requiredXP,
      progress: Math.min(progress, 100),
    };
  }

  static clearCache(): void {
    this.xpCache.clear();
  }

  static calculateVoiceXPPrecise(
    exactMinutes: number,
    xpPerMinute: number
  ): number {
    let totalXP = 0;
    let remainingMinutes = exactMinutes;

    for (const tier of levelConfig.voiceXPMultipliers) {
      const minutesInTier = Math.min(
        remainingMinutes,
        tier.maxMinutes - tier.minMinutes
      );

      if (minutesInTier <= 0) break;

      // NIE zaokrąglamy - używamy dokładnej wartości
      totalXP += minutesInTier * xpPerMinute * tier.multiplier;
      remainingMinutes -= minutesInTier;

      if (remainingMinutes <= 0) break;
    }

    // Zaokrąglamy dopiero na końcu
    return Math.floor(totalXP);
  }
}