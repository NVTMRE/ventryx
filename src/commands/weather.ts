import {ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, MessageFlags} from 'discord.js';
import fetch from 'node-fetch';
import { t } from '../lib/i18n';

const DEBUG = process.env.DEBUG === 'true';

export const data = new SlashCommandBuilder()
  .setName('weather')
  .setDescription(t('commands.weather.description'))
  .addStringOption(option =>
    option
      .setName('postalcode')
      .setDescription(t('commands.weather.options.postalcode'))
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('country')
      .setDescription(t('commands.weather.options.country'))
      .setRequired(true)
      .setMaxLength(2)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;
  if (!OPENWEATHER_API_KEY) {
    // This should never happen if loader filters correctly
    await interaction.reply({
      content: t('commands.weather.disabled') || 'Weather command is disabled because API key is missing.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const postalCode = interaction.options.getString('postalcode', true);
  const country = interaction.options.getString('country') || 'en';

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?zip=${postalCode},${country}&appid=${OPENWEATHER_API_KEY}&units=metric&lang=${process.env.LANG || 'en'}`;

    if (DEBUG) console.debug(`[Weather DEBUG] Fetching URL: ${url}`);

    const response = await fetch(url);

    if (!response.ok) {
      if (DEBUG) console.debug(`[Weather DEBUG] Response status: ${response.status} ${response.statusText}`);
      throw new Error('Failed to fetch weather data');
    }

    const data = (await response.json() as any);

    if (DEBUG) console.debug('[Weather DEBUG] API response data:', data);

    const embed = new EmbedBuilder()
      .setTitle(`${t('commands.weather.response.title')} - ${data.name}`)
      .addFields(
        { name: t('commands.weather.response.temperature'), value: `${data.main.temp} °C`, inline: true },
        { name: t('commands.weather.response.feels_like'), value: `${data.main.feels_like} °C`, inline: true },
        { name: t('commands.weather.response.weather'), value: data.weather[0].description, inline: true },
        { name: t('commands.weather.response.humidity'), value: `${data.main.humidity}%`, inline: true },
        { name: t('commands.weather.response.wind_speed'), value: `${data.wind.speed} m/s`, inline: true }
      )
      .setColor(process.env.EMBED_COLOR ? parseInt(process.env.EMBED_COLOR, 16) : 0x2f3136)
      .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  } catch (error) {
    console.error(error);
    await interaction.reply({
      content: t('commands.weather.error') || 'Could not fetch weather data. Please check the postal code.',
      flags: MessageFlags.Ephemeral,
    });
  }
}

