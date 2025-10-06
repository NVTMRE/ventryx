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

      // Helper: sprawdź czy użytkownik jest aktywny (nie wyciszony)
      const isUserActive = (state: VoiceState): boolean => {
        // Użytkownik NIE jest aktywny jeśli:
        // - jest wyciszony przez serwer (serverMute)
        // - sam się wyciszył (selfMute)
        // - ma wyłączony dźwięk (serverDeaf)
        // - sam wyłączył dźwięk (selfDeaf)
        return (
          !state.serverMute &&
          !state.selfMute &&
          !state.serverDeaf &&
          !state.selfDeaf
        );
      };

      // ========== UŻYTKOWNIK DOŁĄCZYŁ DO KANAŁU ==========
      if (!oldState.channel && newState.channel) {
        const membersInChannel = newState.channel.members.filter(
          (m) => !m.user.bot
        ).size;

        console.log(
          `🎤 ${newState.member?.user.tag} dołączył do VC (${membersInChannel} osób)`
        );

        // Jeśli jest wystarczająco osób i użytkownik jest aktywny
        if (
          membersInChannel >= levelConfigFile.minVoiceMembers &&
          isUserActive(newState)
        ) {
          xpManager.setVoiceJoined(userId, guildId);
          console.log(
            `✅ Rozpoczęto sesję XP dla ${newState.member?.user.tag}`
          );

          // Jeśli to druga osoba, aktywuj pierwszą (jeśli jest aktywna)
          if (membersInChannel === levelConfigFile.minVoiceMembers) {
            for (const [memberId, member] of newState.channel.members) {
              if (
                !member.user.bot &&
                memberId !== userId &&
                member.voice.channel
              ) {
                if (isUserActive(member.voice)) {
                  xpManager.setVoiceJoined(memberId, guildId);
                  console.log(
                    `✅ Rozpoczęto sesję XP dla ${member.user.tag} (aktywacja minimum)`
                  );
                }
              }
            }
          }
        } else if (
          membersInChannel >= levelConfigFile.minVoiceMembers &&
          !isUserActive(newState)
        ) {
          console.log(
            `⏸️ ${newState.member?.user.tag} dołączył ale jest wyciszony`
          );
        }
      }

      // ========== UŻYTKOWNIK OPUŚCIŁ KANAŁ ==========
      else if (oldState.channel && !newState.channel) {
        const membersInOldChannel = oldState.channel.members.filter(
          (m) => !m.user.bot
        ).size;

        console.log(
          `🎤 ${newState.member?.user.tag} opuścił VC (zostało ${membersInOldChannel} osób)`
        );

        const wasValid = membersInOldChannel >= levelConfigFile.minVoiceMembers;

        // Zakończ sesję dla wychodzącego użytkownika
        await xpManager.setVoiceLeft(userId, guildId, wasValid);
        console.log(
          `✅ Zakończono sesję XP dla ${newState.member?.user.tag} (valid: ${wasValid})`
        );

        // Jeśli spadło poniżej minimum, zakończ sesje dla wszystkich
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

        // Rozpocznij nową sesję na nowym kanale (jeśli użytkownik aktywny)
        const membersInNewChannel = newState.channel.members.filter(
          (m) => !m.user.bot
        ).size;

        if (
          membersInNewChannel >= levelConfigFile.minVoiceMembers &&
          isUserActive(newState)
        ) {
          xpManager.setVoiceJoined(userId, guildId);
          console.log(`✅ Rozpoczęto sesję na nowym kanale`);

          // Jeśli to druga osoba, aktywuj pierwszą
          if (membersInNewChannel === levelConfigFile.minVoiceMembers) {
            for (const [memberId, member] of newState.channel.members) {
              if (
                !member.user.bot &&
                memberId !== userId &&
                member.voice.channel
              ) {
                if (isUserActive(member.voice)) {
                  xpManager.setVoiceJoined(memberId, guildId);
                  console.log(
                    `✅ Rozpoczęto sesję XP dla ${member.user.tag} (aktywacja minimum)`
                  );
                }
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

      // ========== ZMIANA STANU WYCISZENIA (MUTE/DEAFEN) ==========
      else if (
        oldState.channel &&
        newState.channel &&
        oldState.channel.id === newState.channel.id
      ) {
        const oldActive = isUserActive(oldState);
        const newActive = isUserActive(newState);

        // Użytkownik się wyciszył/wyłączył dźwięk
        if (oldActive && !newActive) {
          console.log(
            `🔇 ${newState.member?.user.tag} wyciszył się/wyłączył dźwięk`
          );

          const membersInChannel = newState.channel.members.filter(
            (m) => !m.user.bot
          ).size;
          const wasValid = membersInChannel >= levelConfigFile.minVoiceMembers;

          // Wstrzymaj liczenie XP (zapisz obecny czas)
          await xpManager.pauseVoiceSession(userId, guildId, wasValid);
          console.log(
            `⏸️ Wstrzymano sesję XP dla ${newState.member?.user.tag}`
          );
        }

        // Użytkownik się odciszył/włączył dźwięk
        else if (!oldActive && newActive) {
          console.log(
            `🔊 ${newState.member?.user.tag} odciszył się/włączył dźwięk`
          );

          const membersInChannel = newState.channel.members.filter(
            (m) => !m.user.bot
          ).size;

          if (membersInChannel >= levelConfigFile.minVoiceMembers) {
            // Wznów liczenie XP
            xpManager.resumeVoiceSession(userId, guildId);
            console.log(
              `▶️ Wznowiono sesję XP dla ${newState.member?.user.tag}`
            );
          }
        }
      }
    } catch (error) {
      console.error("Error in voice state XP handler:", error);
    }
  },
};

export default event;
