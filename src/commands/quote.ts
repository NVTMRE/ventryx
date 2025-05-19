import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import fetch from 'node-fetch';
import { t } from '../i18n';
// @ts-ignore
import translate from 'translatte';
import {embedColor} from "../config/embed-color";

const TARGET_LANG = process.env.LANG || 'en';

export const data = new SlashCommandBuilder()
  .setName('quote')
  .setDescription(t('commands.quote.description'));

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    // Fetch random quote from ZenQuotes API (50-100 quote at this moment per hour)
    const response = await fetch('https://zenquotes.io/api/random');
    if (!response.ok) throw new Error('Failed to fetch quote');

    const data = (await response.json()) as any[];

    const originalQuote = data[0]?.q || 'No quote found';
    const originalAuthor = data[0]?.a || 'Unknown';

    // Translate quote and author to target language from env
    const translatedQuote = await translate(originalQuote, { to: TARGET_LANG }).then((res: any) => res.text).catch(() => originalQuote);

    // Create embed with translated text
    const embed = new EmbedBuilder()
      .setTitle(t('commands.quote.title'))
      .setDescription(`"${translatedQuote}"`)
      .setFooter({ text: `— ${originalAuthor}` })
      .setColor(embedColor)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    console.error(error);
    await interaction.reply({
      content: t('commands.quote.error') || 'Could not fetch a quote right now, please try again later.',
      ephemeral: true,
    });
  }
}
