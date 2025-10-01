// src/events/guild-member-add.ts

import { Event } from "../types";
import { GuildMember, EmbedBuilder } from "discord.js";
import { db } from "../database/connection";
import { autoRoles } from "../database/schema";
import { eq, and } from "drizzle-orm";

const event: Event = {
  name: "guildMemberAdd",
  execute: async (member: GuildMember) => {
    console.log(`👋 New member joined: ${member.user.tag} (${member.user.id})`);

    // --- AUTOROLE DLA NOWYCH ---
    try {
      const defaultRoleConfig = await db.query.autoRoles.findFirst({
        where: and(
          eq(autoRoles.guildId, member.guild.id),
          eq(autoRoles.isDefault, true)
        ),
      });

      if (defaultRoleConfig) {
        const role = await member.guild.roles.fetch(defaultRoleConfig.roleId);
        if (role) {
          await member.roles.add(role);
          console.log(
            `✅ Nadano domyślną rolę ${role.name} użytkownikowi ${member.user.tag}`
          );
        }
      }
    } catch (error) {
      console.error(
        `❌ Błąd podczas nadawania domyślnej roli nowemu użytkownikowi:`,
        error
      );
    }
    // --- KONIEC AUTOROLI DLA NOWYCH ---

    try {
      const systemChannel = member.guild.systemChannel;
      if (systemChannel) {
        const welcomeEmbed = new EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle("🎉 Witamy na serwerze!")
          .setDescription(`Witaj ${member.user}, miło Cię tu widzieć!`)
          .setThumbnail(member.user.displayAvatarURL())
          .setTimestamp()
          .setFooter({
            text: `Jesteś ${member.guild.memberCount}. członkiem!`,
            iconURL: member.guild.iconURL() || undefined,
          });

        await systemChannel.send({ embeds: [welcomeEmbed] });
      }
    } catch (error) {
      console.error(`❌ Error handling new member ${member.user.tag}:`, error);
    }
  },
};

export default event;
