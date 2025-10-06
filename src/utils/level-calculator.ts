// src/utils/level-calculator.ts

export class LevelCalculator {
  // ============================================
  // KONFIGURACJA PROGRESJI POZIOMÓW
  // ============================================

  // Bazowe XP dla poziomu 2 (poziom 1 = 0 XP)
  private static readonly BASE_XP = 250;

  // Mnożnik wzrostu XP między poziomami
  // 1.5 = każdy poziom wymaga 50% więcej XP niż poprzedni
  // 2.0 = każdy poziom wymaga 2x więcej XP (bardzo szybki wzrost)
  // 1.2 = każdy poziom wymaga 20% więcej XP (wolny wzrost)
  private static readonly MULTIPLIER = 1.50;

  // PRZYKŁADY PROGRESJI:
  // MULTIPLIER = 1.15: Lv2=100, Lv3=115, Lv4=132, Lv5=152, Lv10=303
  // MULTIPLIER = 1.20: Lv2=100, Lv3=120, Lv4=144, Lv5=173, Lv10=516
  // MULTIPLIER = 1.30: Lv2=100, Lv3=130, Lv4=169, Lv5=220, Lv10=1378
  // MULTIPLIER = 1.50: Lv2=100, Lv3=150, Lv4=225, Lv5=338, Lv10=3844

  // ============================================

  /**
   * Oblicza ile XP potrzeba na dany poziom
   */
  static getXPForLevel(level: number): number {
    if (level <= 1) return 0;

    // Formuła: BASE_XP * (MULTIPLIER ^ (level - 2))
    const xp = Math.floor(this.BASE_XP * Math.pow(this.MULTIPLIER, level - 2));

    return xp;
  }

  /**
   * Oblicza całkowite XP potrzebne do osiągnięcia poziomu
   * (suma XP ze wszystkich poprzednich poziomów)
   */
  static getTotalXPForLevel(level: number): number {
    let total = 0;
    for (let i = 2; i <= level; i++) {
      total += this.getXPForLevel(i);
    }
    return total;
  }

  /**
   * Oblicza poziom na podstawie całkowitego XP
   */
  static calculateLevel(totalXP: number): number {
    if (totalXP < this.BASE_XP) return 1;

    let level = 1;
    let accumulatedXP = 0;

    while (true) {
      const xpForNext = this.getXPForLevel(level + 1);
      if (accumulatedXP + xpForNext > totalXP) break;
      accumulatedXP += xpForNext;
      level++;
    }

    return level;
  }

  /**
   * Zwraca szczegółowe informacje o poziomie
   */
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
    const progress = (currentXP / requiredXP) * 100;

    return {
      level,
      currentXP,
      requiredXP,
      progress: Math.min(progress, 100),
    };
  }

  /**
   * Sprawdza czy użytkownik awansował
   */
  static checkLevelUp(oldXP: number, newXP: number): number | null {
    const oldLevel = this.calculateLevel(oldXP);
    const newLevel = this.calculateLevel(newXP);
    return newLevel > oldLevel ? newLevel : null;
  }

  /**
   * Losowe XP z wariacją
   */
  static getRandomXP(base: number, variance: number): number {
    const min = base - variance;
    const max = base + variance;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Oblicza XP za czas spędzony na VC (z dokładnością dziesiętną)
   */
  static calculateVoiceXPPrecise(minutes: number, xpPerMinute: number): number {
    return Math.floor(minutes * xpPerMinute);
  }

  /**
   * Generuje tabelę progresji poziomów
   */
  static generateProgressionTable(maxLevel: number = 30): string {
    let table = "┌────────┬─────────────┬──────────────┐\n";
    table += "│ Poziom │ XP na level │ Całkowite XP │\n";
    table += "├────────┼─────────────┼──────────────┤\n";

    for (let level = 1; level <= maxLevel; level++) {
      const xpForLevel = this.getXPForLevel(level);
      const totalXP = this.getTotalXPForLevel(level);

      const levelStr = level.toString().padStart(6);
      const xpStr = xpForLevel.toLocaleString().padStart(11);
      const totalStr = totalXP.toLocaleString().padStart(12);

      table += `│ ${levelStr} │ ${xpStr} │ ${totalStr} │\n`;
    }

    table += "└────────┴─────────────┴──────────────┘\n";
    table += `\nProgresja: BASE=${this.BASE_XP} XP, MULTIPLIER=${this.MULTIPLIER}x`;

    return table;
  }

  /**
   * Szybka kalkulacja: ile czasu potrzeba na poziom
   */
  static estimateTimeForLevel(
    level: number,
    messagesPerHour: number = 30,
    voiceMinutesPerDay: number = 60,
    xpPerMessage: number = 15,
    xpPerVoiceMinute: number = 5
  ): string {
    const requiredXP = this.getXPForLevel(level);

    // XP dziennie
    const messageXPPerDay = (messagesPerHour / 60) * 24 * 60 * xpPerMessage;
    const voiceXPPerDay = voiceMinutesPerDay * xpPerVoiceMinute;
    const totalXPPerDay = messageXPPerDay + voiceXPPerDay;

    const daysNeeded = Math.ceil(requiredXP / totalXPPerDay);

    return `Poziom ${level}: ${requiredXP} XP (~${daysNeeded} dni aktywności)`;
  }
}
