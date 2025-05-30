import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { t } from '../lib/i18n';

export const data = new SlashCommandBuilder()
  .setName('meme')
  .setDescription(t('commands.meme.description'));

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const response = await fetch('https://meme-api.com/gimme');
    const meme = await response.json();

    if (!meme || !meme.url) {
      throw new Error('Invalid response from API');
    }

    // Reply with the meme image only
    await interaction.reply({ content: meme.url });
  } catch (error) {
    console.error('Meme fetch error:', error);
    await interaction.reply({
      content: t('commands.meme.error'),
    });
  }
}
