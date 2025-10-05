import { Event } from "../types";
import { VoiceState } from "discord.js";
import { XPManager } from "../managers/xp-manager";
import { db } from "../database/connection";
import { levelConfig } from "../database/schema";
import { eq } from "drizzle-orm";
import levelConfigFile from "../config/levels";

const event: Event = {
  name: "voiceStateUpdate",
  execute: async (oldState: VoiceState, newState: VoiceState) => {
    // Ignoruj boty
    if (newState.member?.user.bot) return;

    const userId = newState.member?.id;
    const guildId = newState.guild.id;

    if (!userId) return;

    try {
      // Pobierz konfigurację serwera
      const configs = await db
        .select()
        .from(levelConfig)
        .where(eq(levelConfig.guildId, guildId))
        .limit(1);

      const config = configs[0];

      // Jeśli system jest wyłączony, zakończ
      if (config && !config.enabled) return;

      const xpManager = XPManager.getInstance();

      // ========== UŻYTKOWNIK DOŁĄCZYŁ DO KANAŁU ==========
      if (!oldState.channel && newState.channel) {
        const membersInChannel = newState.channel.members.filter(
          (m) => !m.user.bot
        ).size;

        console.log(
          `🎤 ${newState.member?.user.tag} dołączył do VC (${membersInChannel} osób)`
        );

        // Jeśli jest wystarczająco osób, rozpocznij sesję dla nowego użytkownika
        if (membersInChannel >= levelConfigFile.minVoiceMembers) {
          xpManager.setVoiceJoined(userId, guildId);
          console.log(
            `✅ Rozpoczęto sesję XP dla ${newState.member?.user.tag}`
          );

          // NOWE: Jeśli to druga osoba, która dołączyła, rozpocznij sesję dla pierwszej osoby też
          if (membersInChannel === levelConfigFile.minVoiceMembers) {
            for (const [memberId, member] of newState.channel.members) {
              if (!member.user.bot && memberId !== userId) {
                xpManager.setVoiceJoined(memberId, guildId);
                console.log(
                  `✅ Rozpoczęto sesję XP dla ${member.user.tag} (aktywacja minimum)`
                );
              }
            }
          }
        }
      }

      // ========== UŻYTKOWNIK OPUŚCIŁ KANAŁ ==========
      else if (oldState.channel && !newState.channel) {
        // Liczba osób PRZED wyjściem użytkownika
        const membersInOldChannel = oldState.channel.members.filter(
          (m) => !m.user.bot
        ).size;

        console.log(
          `🎤 ${newState.member?.user.tag} opuścił VC (zostało ${membersInOldChannel} osób)`
        );

        // Użytkownik był na kanale z wystarczającą liczbą osób
        const wasValid = membersInOldChannel >= levelConfigFile.minVoiceMembers;

        // NATYCHMIASTOWO zakończ sesję i zapisz XP dla wychodzącego użytkownika
        await xpManager.setVoiceLeft(userId, guildId, wasValid);
        console.log(
          `✅ Zakończono sesję XP dla ${newState.member?.user.tag} (valid: ${wasValid})`
        );

        // NOWE: Jeśli po wyjściu zostało mniej niż minimum osób, zakończ sesje dla pozostałych
        if (membersInOldChannel < levelConfigFile.minVoiceMembers) {
          console.log(
            `⚠️ Spadek poniżej minimum (${membersInOldChannel}), kończę wszystkie sesje`
          );
          for (const [memberId, member] of oldState.channel.members) {
            if (!member.user.bot) {
              await xpManager.setVoiceLeft(memberId, guildId, true);
              console.log(
                `✅ Zakończono sesję XP dla ${member.user.tag} (brak minimum)`
              );
            }
          }
        }
      }

      // ========== UŻYTKOWNIK PRZEŁĄCZYŁ SIĘ MIĘDZY KANAŁAMI ==========
      else if (
        oldState.channel &&
        newState.channel &&
        oldState.channel.id !== newState.channel.id
      ) {
        console.log(
          `🎤 ${newState.member?.user.tag} przełączył się między kanałami`
        );

        // Zakończ sesję na starym kanale
        const membersInOldChannel = oldState.channel.members.filter(
          (m) => !m.user.bot
        ).size;
        const wasOldValid =
          membersInOldChannel >= levelConfigFile.minVoiceMembers;

        await xpManager.setVoiceLeft(userId, guildId, wasOldValid);
        console.log(
          `✅ Zakończono sesję na starym kanale (valid: ${wasOldValid})`
        );

        // Rozpocznij nową sesję na nowym kanale
        const membersInNewChannel = newState.channel.members.filter(
          (m) => !m.user.bot
        ).size;

        if (membersInNewChannel >= levelConfigFile.minVoiceMembers) {
          xpManager.setVoiceJoined(userId, guildId);
          console.log(`✅ Rozpoczęto sesję na nowym kanale`);

          // Jeśli to druga osoba, aktywuj pierwszą
          if (membersInNewChannel === levelConfigFile.minVoiceMembers) {
            for (const [memberId, member] of newState.channel.members) {
              if (!member.user.bot && memberId !== userId) {
                xpManager.setVoiceJoined(memberId, guildId);
                console.log(
                  `✅ Rozpoczęto sesję XP dla ${member.user.tag} (aktywacja minimum)`
                );
              }
            }
          }
        }

        // Sprawdź czy na starym kanale nie spadło poniżej minimum
        if (membersInOldChannel < levelConfigFile.minVoiceMembers) {
          for (const [memberId, member] of oldState.channel.members) {
            if (!member.user.bot) {
              await xpManager.setVoiceLeft(memberId, guildId, true);
              console.log(
                `✅ Zakończono sesję XP dla ${member.user.tag} na starym kanale (brak minimum)`
              );
            }
          }
        }
      }
    } catch (error) {
      console.error("Error in voice state XP handler:", error);
    }
  },
};

export default event;
