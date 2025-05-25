import {ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder} from 'discord.js';
import { t } from '../lib/i18n';
// @ts-ignore
import translate from 'translatte';

export const data = new SlashCommandBuilder()
  .setName('fact')
  .setDescription(t('commands.fact.description'));

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const locale = interaction.locale;

    const res = await fetch('https://uselessfacts.jsph.pl/random.json?language=en');
    const data = await res.json();
    let fact = data.text;

    if (locale !== 'en-US') {
      const translated = await translate(fact, { to: locale });
      fact = translated.text;
    }

    await interaction.reply({ content: `📢 ${fact}`, flags: MessageFlags.Ephemeral });
  } catch (error) {
    console.error('Fact fetch error:', error);
    await interaction.reply({
      content: t('commands.fact.error'),
      flags: MessageFlags.Ephemeral,
    });
  }
}
