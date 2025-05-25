import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from 'discord.js';
import fetch from 'node-fetch';
import { t } from '../lib/i18n';
// @ts-ignore
import translate from 'translatte';

export const data = new SlashCommandBuilder()
  .setName('joke')
  .setDescription(t('commands.joke.description'));

export async function execute(interaction: ChatInputCommandInteraction) {
  const locale = interaction.locale;

  try {
    const res = await fetch('https://v2.jokeapi.dev/joke/Any?format=txt');
    const jokeText = await res.text();

    let finalJoke = jokeText;

    // Translate if the user prefers Polish
    if (locale !== 'en-US') {
      const translated = await translate(jokeText, { to: locale });
      finalJoke = translated.text;
    }

    await interaction.reply({
      content: `😂 ${finalJoke}`,
      ephemeral: true,
    });
  } catch (error) {
    console.error('Error fetching or translating joke:', error);
    await interaction.reply({
      content: t('commands.joke.error'),
      ephemeral: true,
    });
  }
}
