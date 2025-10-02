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
  voiceTimeToAdd: number;
  voiceJoinedAt?: Date | null;
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
    const existing = this.pendingVoiceUpdates.get(key);

    if (existing) {
      existing.voiceJoinedAt = new Date();
    } else {
      this.pendingVoiceUpdates.set(key, {
        userId,
        guildId,
        voiceTimeToAdd: 0,
        voiceJoinedAt: new Date(),
      });
    }
  }

  async setVoiceLeft(
    userId: string,
    guildId: string,
    wasInValidChannel: boolean
  ): Promise<void> {
    const key = this.getKey(userId, guildId);
    const pending = this.pendingVoiceUpdates.get(key);

    if (!pending || !pending.voiceJoinedAt || !wasInValidChannel) {
      this.pendingVoiceUpdates.delete(key);
      return;
    }

    const now = new Date();
    const timeSpent = Math.floor(
      (now.getTime() - pending.voiceJoinedAt.getTime()) / 1000
    );

    pending.voiceTimeToAdd += timeSpent;
    pending.voiceJoinedAt = null;
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

    // Przetwarzanie XP z voice
    const toRemove: string[] = [];

    for (const [key, update] of this.pendingVoiceUpdates) {
      if (!update) throw new Error("Pending voice update is undefined");
      try {
        // Przypadek 1: Użytkownik opuścił VC (voiceJoinedAt === null)
        if (update.voiceJoinedAt === null && update.voiceTimeToAdd > 0) {
          const result = await this.applyVoiceUpdate(update);
          if (result.leveledUp) {
            levelUps.push({
              userId: update.userId,
              guildId: update.guildId,
              newLevel: result.newLevel!,
            });
          }
          voiceUpdates++;
          // Oznacz do usunięcia - użytkownik już wyszedł
          toRemove.push(key);
        }
        // Przypadek 2: Użytkownik wciąż jest na VC (voiceJoinedAt !== null)
        else if (update.voiceJoinedAt !== null) {
          const now = new Date();
          const timeSpent = Math.floor(
            (now.getTime() - update.voiceJoinedAt.getTime()) / 1000
          );

          // Jeśli spędził już jakiś czas, dodaj XP
          if (timeSpent > 0) {
            update.voiceTimeToAdd += timeSpent;

            const result = await this.applyVoiceUpdate(update);
            if (result.leveledUp) {
              levelUps.push({
                userId: update.userId,
                guildId: update.guildId,
                newLevel: result.newLevel!,
              });
            }
            voiceUpdates++;

            // Reset licznika - zaczynamy liczyć od nowa
            update.voiceTimeToAdd = 0;
            update.voiceJoinedAt = now;
          }
          // NIE usuwamy wpisu - użytkownik wciąż jest na VC!
        }
      } catch (error) {
        console.error(`Failed to apply voice update for ${key}:`, error);
      }
    }

    // Usuń tylko użytkowników którzy opuścili VC
    for (const key of toRemove) {
      this.pendingVoiceUpdates.delete(key);
    }

    // Wyczyść XP z wiadomości (zawsze bezpieczne)
    this.pendingXPUpdates.clear();

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
    const minutes = Math.floor(update.voiceTimeToAdd / 60);
    const xpToAdd = LevelCalculator.calculateVoiceXP(
      minutes,
      config.xpPerVoiceMinute
    );

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