// src/managers/xp-manager.ts

import { db } from "../database/connection";
import {
  userLevels,
  levelConfig as levelConfigTable,
  levelRoles,
} from "../database/schema";
import { eq, and, desc } from "drizzle-orm";
import { LevelCalculator } from "../utils/level-calculator";
import levelConfig from "../config/levels";

interface PendingXPUpdate {
  userId: string;
  guildId: string;
  xpToAdd: number;
  messageCount?: number;
  lastMessageAt?: Date;
}

interface PendingVoiceUpdate {
  userId: string;
  guildId: string;
  totalSecondsSpent: number; // ZMIANA: całkowity czas od początku sesji
  sessionStartedAt: Date | null; // ZMIANA: kiedy rozpoczęła się cała sesja
  lastFlushAt: Date | null; // ZMIANA: kiedy ostatnio przetworzyliśmy XP
}

export class XPManager {
  private static instance: XPManager;
  private pendingXPUpdates: Map<string, PendingXPUpdate> = new Map();
  private pendingVoiceUpdates: Map<string, PendingVoiceUpdate> = new Map();
  private messageTimestamps: Map<string, Date[]> = new Map();
  private lastMessageTime: Map<string, Date> = new Map();

  private constructor() {}

  static getInstance(): XPManager {
    if (!XPManager.instance) {
      XPManager.instance = new XPManager();
    }
    return XPManager.instance;
  }

  private getKey(userId: string, guildId: string): string {
    return `${guildId}:${userId}`;
  }

  private isSpam(userId: string, guildId: string): boolean {
    const key = this.getKey(userId, guildId);
    const now = new Date();
    const timestamps = this.messageTimestamps.get(key) || [];

    const cutoff = new Date(now.getTime() - levelConfig.spamTimeWindow * 1000);
    const recentTimestamps = timestamps.filter((t) => t > cutoff);

    if (recentTimestamps.length >= levelConfig.maxMessagesPerMinute) {
      return true;
    }

    recentTimestamps.push(now);
    this.messageTimestamps.set(key, recentTimestamps);
    return false;
  }

  private isOnCooldown(
    userId: string,
    guildId: string,
    cooldownSeconds: number
  ): boolean {
    const key = this.getKey(userId, guildId);
    const lastMessage = this.lastMessageTime.get(key);

    if (!lastMessage) {
      this.lastMessageTime.set(key, new Date());
      return false;
    }

    const now = new Date();
    const diff = (now.getTime() - lastMessage.getTime()) / 1000;

    if (diff < cooldownSeconds) {
      return true;
    }

    this.lastMessageTime.set(key, now);
    return false;
  }

  async addMessageXP(userId: string, guildId: string): Promise<boolean> {
    const key = this.getKey(userId, guildId);
    const config = await this.getGuildConfig(guildId);

    if (!config.enabled) return false;
    if (this.isSpam(userId, guildId)) return false;
    if (this.isOnCooldown(userId, guildId, config.messageCooldown))
      return false;

    const xp = LevelCalculator.getRandomXP(
      config.xpPerMessage,
      config.xpPerMessageVariance
    );

    const existing = this.pendingXPUpdates.get(key);
    if (existing) {
      existing.xpToAdd += xp;
      existing.messageCount = (existing.messageCount || 0) + 1;
      existing.lastMessageAt = new Date();
    } else {
      this.pendingXPUpdates.set(key, {
        userId,
        guildId,
        xpToAdd: xp,
        messageCount: 1,
        lastMessageAt: new Date(),
      });
    }

    return true;
  }

  setVoiceJoined(userId: string, guildId: string): void {
    const key = this.getKey(userId, guildId);
    const now = new Date();
    
    const existing = this.pendingVoiceUpdates.get(key);
    
    // Jeśli użytkownik już ma aktywną sesję, nie rób nic
    if (existing && existing.sessionStartedAt) {
      console.log(`⚠️ Użytkownik ${userId} już ma aktywną sesję VC, pomijam`);
      return;
    }

    // Rozpocznij NOWĄ sesję
    this.pendingVoiceUpdates.set(key, {
      userId,
      guildId,
      totalSecondsSpent: 0,
      sessionStartedAt: now,
      lastFlushAt: now,
    });
    
    console.log(`📝 Rozpoczęto NOWĄ sesję VC dla ${userId} o ${now.toISOString()}`);
  }

  async setVoiceLeft(
    userId: string,
    guildId: string,
    wasInValidChannel: boolean
  ): Promise<void> {
    const key = this.getKey(userId, guildId);
    const pending = this.pendingVoiceUpdates.get(key);

    console.log(`📤 setVoiceLeft wywołane dla ${userId}, wasInValidChannel: ${wasInValidChannel}`);

    if (!pending || !wasInValidChannel) {
      console.log(`❌ Brak ważnej sesji do zakończenia dla ${userId}`);
      this.pendingVoiceUpdates.delete(key);
      return;
    }

    if (!pending.sessionStartedAt) {
      console.log(`⚠️ Użytkownik ${userId} nie ma aktywnej sesji`);
      return;
    }

    const now = new Date();
    
    // Oblicz czas od rozpoczęcia sesji (CAŁKOWITY CZAS)
    const totalTimeInSession = Math.floor(
      (now.getTime() - pending.sessionStartedAt.getTime()) / 1000
    );

    console.log(`⏱️ CAŁKOWITY czas na VC: ${totalTimeInSession}s (${Math.floor(totalTimeInSession / 60)} min ${totalTimeInSession % 60}s)`);
    console.log(`📊 Poprzednio przetworzone: ${pending.totalSecondsSpent}s`);

    // Ustaw końcowy czas - to jest suma wszystkich sekund od początku sesji
    pending.totalSecondsSpent = totalTimeInSession;
    pending.sessionStartedAt = null; // Oznacz jako zakończoną sesję
    pending.lastFlushAt = null;
    
    console.log(`✅ Zakolejkowano ${pending.totalSecondsSpent}s (${Math.floor(pending.totalSecondsSpent / 60)} min) XP dla ${userId} do wypłaty`);
  }

  private configCache: Map<string, { config: any; timestamp: number }> =
    new Map();

  async getGuildConfig(guildId: string): Promise<any> {
    const cached = this.configCache.get(guildId);
    const now = Date.now();

    if (cached && now - cached.timestamp < 300000) {
      return cached.config;
    }

    const configs = await db
      .select()
      .from(levelConfigTable)
      .where(eq(levelConfigTable.guildId, guildId))
      .limit(1);

    let config = configs[0];

    if (!config) {
      const newConfig = await db
        .insert(levelConfigTable)
        .values({
          guildId,
          xpPerMessage: levelConfig.defaultXPPerMessage,
          xpPerMessageVariance: levelConfig.defaultXPVariance,
          xpPerVoiceMinute: levelConfig.defaultXPPerVoiceMinute,
          messageCooldown: levelConfig.messageCooldown,
        })
        .returning();

      config = newConfig[0];
    }

    this.configCache.set(guildId, { config, timestamp: now });
    return config;
  }

  async flush(): Promise<{
    xpUpdates: number;
    voiceUpdates: number;
    levelUps: Array<{ userId: string; guildId: string; newLevel: number }>;
  }> {
    const levelUps: Array<{
      userId: string;
      guildId: string;
      newLevel: number;
    }> = [];
    let xpUpdates = 0;
    let voiceUpdates = 0;

    console.log(`\n🔄 === FLUSH START ===`);
    console.log(`📊 Pending XP updates: ${this.pendingXPUpdates.size}`);
    console.log(`🎤 Pending Voice updates: ${this.pendingVoiceUpdates.size}`);

    // Przetwarzanie XP z wiadomości
    for (const [key, update] of this.pendingXPUpdates) {
      try {
        const result = await this.applyXPUpdate(update);
        if (result.leveledUp) {
          levelUps.push({
            userId: update.userId,
            guildId: update.guildId,
            newLevel: result.newLevel!,
          });
        }
        xpUpdates++;
      } catch (error) {
        console.error(`Failed to apply XP update for ${key}:`, error);
      }
    }

    // NOWA LOGIKA GŁOSOWA
    const toRemove: string[] = [];
    const now = new Date();

    for (const [key, update] of this.pendingVoiceUpdates) {
      if (!update) {
        console.error(`⚠️ Undefined voice update for ${key}`);
        continue;
      }

      try {
        // PRZYPADEK 1: Użytkownik OPUŚCIŁ VC (sessionStartedAt === null)
        if (update.sessionStartedAt === null && update.totalSecondsSpent > 0) {
          console.log(`💰 Użytkownik ${update.userId} wyszedł z VC, wypłacam ${update.totalSecondsSpent}s (${Math.floor(update.totalSecondsSpent / 60)} min)`);
          
          const result = await this.applyVoiceUpdate(update);
          if (result.leveledUp) {
            levelUps.push({
              userId: update.userId,
              guildId: update.guildId,
              newLevel: result.newLevel!,
            });
          }
          voiceUpdates++;
          toRemove.push(key);
        }
        // PRZYPADEK 2: Użytkownik WCIĄŻ NA VC (sessionStartedAt !== null)
        else if (update.sessionStartedAt && update.lastFlushAt) {
          // Oblicz całkowity czas od POCZĄTKU SESJI
          const totalTimeInSession = Math.floor(
            (now.getTime() - update.sessionStartedAt.getTime()) / 1000
          );
          
          // Oblicz nowy czas od ostatniego flush
          const timeSinceLastFlush = Math.floor(
            (now.getTime() - update.lastFlushAt.getTime()) / 1000
          );

          console.log(`🎙️ Użytkownik ${update.userId} wciąż na VC:`);
          console.log(`   ⏱️  Całkowity czas w sesji: ${totalTimeInSession}s (${Math.floor(totalTimeInSession / 60)} min ${totalTimeInSession % 60}s)`);
          console.log(`   🔄 Od ostatniego flush: ${timeSinceLastFlush}s`);
          console.log(`   📊 Poprzednio przetworzone: ${update.totalSecondsSpent}s`);

          // Jeśli minęło przynajmniej kilka sekund, wypłać XP za NOWY czas
          if (timeSinceLastFlush > 0) {
            const newSecondsToProcess = totalTimeInSession - update.totalSecondsSpent;
            
            if (newSecondsToProcess > 0) {
              console.log(`   💰 Wypłacam XP za NOWE ${newSecondsToProcess}s`);
              
              // Stwórz tymczasowy update tylko z NOWYM czasem
              const tempUpdate = {
                ...update,
                totalSecondsSpent: newSecondsToProcess,
              };
              
              const result = await this.applyVoiceUpdate(tempUpdate);
              if (result.leveledUp) {
                levelUps.push({
                  userId: update.userId,
                  guildId: update.guildId,
                  newLevel: result.newLevel!,
                });
              }
              voiceUpdates++;

              // Zaktualizuj ile już przetworzyliśmy
              update.totalSecondsSpent = totalTimeInSession;
              update.lastFlushAt = now;
              
              console.log(`   ✅ Zaktualizowano: przetworzone łącznie ${update.totalSecondsSpent}s`);
            }
          }
          // NIE usuwamy - użytkownik wciąż na VC!
        }
        // PRZYPADEK 3: Cleanup pustych wpisów
        else if (!update.sessionStartedAt && update.totalSecondsSpent === 0) {
          console.log(`🧹 Czyszczę pusty wpis dla ${update.userId}`);
          toRemove.push(key);
        }
        
      } catch (error) {
        console.error(
          `Nie udało się zastosować aktualizacji głosowej dla ${key}:`,
          error
        );
      }
    }

    // Usuń tylko zakończone sesje
    for (const key of toRemove) {
      console.log(`🗑️ Usuwam wpis: ${key}`);
      this.pendingVoiceUpdates.delete(key);
    }

    // Wyczyść XP z wiadomości
    this.pendingXPUpdates.clear();

    console.log(`✅ XP Updates: ${xpUpdates}, Voice Updates: ${voiceUpdates}, Level Ups: ${levelUps.length}`);
    console.log(`🎤 Pozostałe aktywne sesje VC: ${this.pendingVoiceUpdates.size}`);
    console.log(`🔄 === FLUSH END ===\n`);

    return { xpUpdates, voiceUpdates, levelUps };
  }

  private async applyXPUpdate(update: PendingXPUpdate): Promise<{
    leveledUp: boolean;
    newLevel?: number;
  }> {
    const existing = await db
      .select()
      .from(userLevels)
      .where(
        and(
          eq(userLevels.userId, update.userId),
          eq(userLevels.guildId, update.guildId)
        )
      )
      .limit(1);

    const oldXP = existing[0]?.totalXP || 0;
    const newXP = oldXP + update.xpToAdd;
    const newLevel = LevelCalculator.calculateLevel(newXP);

    if (existing[0]) {
      await db
        .update(userLevels)
        .set({
          totalXP: newXP,
          level: newLevel,
          lastMessageAt: update.lastMessageAt,
        })
        .where(
          and(
            eq(userLevels.userId, update.userId),
            eq(userLevels.guildId, update.guildId)
          )
        );
    } else {
      await db.insert(userLevels).values({
        userId: update.userId,
        guildId: update.guildId,
        totalXP: newXP,
        level: newLevel,
        lastMessageAt: update.lastMessageAt,
      });
    }

    const leveledUp = LevelCalculator.checkLevelUp(oldXP, newXP) !== null;
    return { leveledUp, newLevel: leveledUp ? newLevel : undefined };
  }

  private async applyVoiceUpdate(update: PendingVoiceUpdate): Promise<{
    leveledUp: boolean;
    newLevel?: number;
  }> {
    const config = await this.getGuildConfig(update.guildId);
    
    // Zamień sekundy na minuty (z dokładnością dziesiętną)
    const exactMinutes = update.totalSecondsSpent / 60;
    const xpToAdd = LevelCalculator.calculateVoiceXPPrecise(
      exactMinutes,
      config.xpPerVoiceMinute
    );

    console.log(`💎 Obliczono XP: ${update.totalSecondsSpent}s (${exactMinutes.toFixed(2)} min) = ${xpToAdd} XP dla ${update.userId}`);

    const existing = await db
      .select()
      .from(userLevels)
      .where(
        and(
          eq(userLevels.userId, update.userId),
          eq(userLevels.guildId, update.guildId)
        )
      )
      .limit(1);

    const oldXP = existing[0]?.totalXP || 0;
    const newXP = oldXP + xpToAdd;
    const newLevel = LevelCalculator.calculateLevel(newXP);

    console.log(`📈 ${update.userId}: ${oldXP} XP -> ${newXP} XP (+${xpToAdd} XP, level ${newLevel})`);

    if (existing[0]) {
      await db
        .update(userLevels)
        .set({
          totalXP: newXP,
          level: newLevel,
        })
        .where(
          and(
            eq(userLevels.userId, update.userId),
            eq(userLevels.guildId, update.guildId)
          )
        );
    } else {
      await db.insert(userLevels).values({
        userId: update.userId,
        guildId: update.guildId,
        totalXP: newXP,
        level: newLevel,
      });
    }

    const leveledUp = LevelCalculator.checkLevelUp(oldXP, newXP) !== null;
    return { leveledUp, newLevel: leveledUp ? newLevel : undefined };
  }

  async getUserStats(userId: string, guildId: string) {
    const user = await db
      .select()
      .from(userLevels)
      .where(
        and(eq(userLevels.userId, userId), eq(userLevels.guildId, guildId))
      )
      .limit(1);

    if (!user[0]) {
      return {
        level: 1,
        totalXP: 0,
        currentXP: 0,
        requiredXP: LevelCalculator.getXPForLevel(2),
        progress: 0,
      };
    }

    const levelData = LevelCalculator.getLevelFromXP(user[0].totalXP);
    return {
      level: levelData.level,
      totalXP: user[0].totalXP,
      currentXP: levelData.currentXP,
      requiredXP: levelData.requiredXP,
      progress: levelData.progress,
    };
  }

  async getLeaderboard(guildId: string, limit: number = 10) {
    return await db
      .select()
      .from(userLevels)
      .where(eq(userLevels.guildId, guildId))
      .orderBy(desc(userLevels.totalXP))
      .limit(limit);
  }

  async getUserLevel(userId: string, guildId: string) {
    const result = await db
      .select()
      .from(userLevels)
      .where(
        and(eq(userLevels.userId, userId), eq(userLevels.guildId, guildId))
      )
      .limit(1);

    return result[0] || null;
  }

  async getLevelRoles(guildId: string) {
    return await db
      .select()
      .from(levelRoles)
      .where(eq(levelRoles.guildId, guildId));
  }
}