import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { t } from '../i18n';
import pkg from '../../package.json' assert { type: 'json' };

export const data = new SlashCommandBuilder()
  .setName('botinfo')
  .setDescription(t('commands.botinfo.description'));

export async function execute(interaction: ChatInputCommandInteraction) {
  const botName = interaction.client.user?.username || 'Bot';
  const embed = new EmbedBuilder()
    .setTitle(`${botName} (Ventryx Bot)`)
    .setDescription(t('commands.botinfo.response.description'))
    .setURL('https://github.com/NVTMRE/ventryx') // link do repozytorium
    .setThumbnail('https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png')
    .addFields(
      { name: t('commands.botinfo.response.developer'), value: '[Ksawier Malkiewicz "NVTMRE"](https://github.com/NVTMRE)', inline: true },
      { name: t('commands.botinfo.response.language'), value: 'TypeScript / Discord.js', inline: true },
      { name: t('commands.botinfo.response.version'), value: pkg.version || 'N/A', inline: true },
      { name: t('commands.botinfo.response.license'), value: pkg.license || 'N/A', inline: true }
    )
    .setColor(0x2f3136)
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
