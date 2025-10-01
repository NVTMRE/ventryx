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

      // Użytkownik dołączył do kanału głosowego
      if (!oldState.channel && newState.channel) {
        // Sprawdź czy na kanale jest wystarczająco osób (min 2)
        const membersInChannel = newState.channel.members.filter(
          (m) => !m.user.bot
        ).size;

        if (membersInChannel >= levelConfigFile.minVoiceMembers) {
          xpManager.setVoiceJoined(userId, guildId);
          console.log(
            `🎤 ${newState.member?.user.tag} dołączył do VC w ${newState.guild.name}`
          );
        }
      }

      // Użytkownik opuścił kanał głosowy
      else if (oldState.channel && !newState.channel) {
        // Sprawdź czy był na prawidłowym kanale (z wystarczającą ilością osób)
        const membersInOldChannel = oldState.channel.members.filter(
          (m) => !m.user.bot
        ).size;
        const wasValid =
          membersInOldChannel >= levelConfigFile.minVoiceMembers - 1; // -1 bo user już wyszedł

        await xpManager.setVoiceLeft(userId, guildId, wasValid);
        console.log(
          `🎤 ${newState.member?.user.tag} opuścił VC w ${newState.guild.name}`
        );
      }

      // Użytkownik przełączył się między kanałami
      else if (
        oldState.channel &&
        newState.channel &&
        oldState.channel.id !== newState.channel.id
      ) {
        // Zakończ sesję na starym kanale
        const membersInOldChannel = oldState.channel.members.filter(
          (m) => !m.user.bot
        ).size;
        const wasOldValid =
          membersInOldChannel >= levelConfigFile.minVoiceMembers - 1;

        await xpManager.setVoiceLeft(userId, guildId, wasOldValid);

        // Rozpocznij nową sesję na nowym kanale
        const membersInNewChannel = newState.channel.members.filter(
          (m) => !m.user.bot
        ).size;

        if (membersInNewChannel >= levelConfigFile.minVoiceMembers) {
          xpManager.setVoiceJoined(userId, guildId);
        }

        console.log(
          `🎤 ${newState.member?.user.tag} przełączył się między kanałami VC`
        );
      }

      // Użytkownik zmienił stan (mute/unmute/deafen) - sprawdź czy nadal jest wystarczająco osób
      else if (
        oldState.channel &&
        newState.channel &&
        oldState.channel.id === newState.channel.id
      ) {
        const membersInChannel = newState.channel.members.filter(
          (m) => !m.user.bot
        ).size;

        // Jeśli spadło poniżej minimum, zakończ sesję wszystkim
        if (membersInChannel < levelConfigFile.minVoiceMembers) {
          // Zakończ sesję dla tego użytkownika
          await xpManager.setVoiceLeft(userId, guildId, false);

          // Zakończ sesje dla pozostałych użytkowników na kanale
          for (const [memberId, member] of newState.channel.members) {
            if (!member.user.bot && memberId !== userId) {
              await xpManager.setVoiceLeft(memberId, guildId, false);
            }
          }
        }
        // Jeśli wzrosło do minimum, rozpocznij sesje
        else if (membersInChannel === levelConfigFile.minVoiceMembers) {
          // Rozpocznij sesje dla wszystkich na kanale
          for (const [memberId, member] of newState.channel.members) {
            if (!member.user.bot) {
              xpManager.setVoiceJoined(memberId, guildId);
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
