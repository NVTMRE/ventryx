import { Event } from "../types";
import { GuildMember, EmbedBuilder } from "discord.js";
import { db } from "../database/connection";

const event: Event = {
  name: "guildMemberAdd",
  execute: async (member: GuildMember) => {
    console.log(`👋 New member joined: ${member.user.tag} (${member.user.id})`);

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
