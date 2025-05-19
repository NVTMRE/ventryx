import {ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder} from 'discord.js';
import { t } from '../i18n';

export const data = new SlashCommandBuilder()
  .setName('roll')
  .setDescription(t('commands.roll.description'))
  .addIntegerOption(option =>
    option
      .setName('min')
      .setDescription(t('commands.roll.options.min'))
      .setRequired(false)
  )
  .addIntegerOption(option =>
    option
      .setName('max')
      .setDescription(t('commands.roll.options.max'))
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const min = interaction.options.getInteger('min') ?? 1;
  const max = interaction.options.getInteger('max') ?? 100;

  if (min > max) {
    await interaction.reply({
      content: t('commands.roll.error_min_greater_max'),
      ephemeral: true,
    });
    return;
  }

  const rollResult = Math.floor(Math.random() * (max - min + 1)) + min;

  await interaction.reply({
    content: t('commands.roll.response', {
      min: min.toString(),
      max: max.toString(),
      rollResult: rollResult.toString()
    }),
    flags: MessageFlags.Ephemeral,
  })}
