import {ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder} from 'discord.js';
import { t } from '../i18n';

export const data = new SlashCommandBuilder()
  .setName('coin-flip')
  .setDescription(t('commands.coin_flip.description'));

export async function execute(interaction: ChatInputCommandInteraction) {
  const outcomes = [t('commands.coin_flip.heads'), t('commands.coin_flip.tails')];
  const result = outcomes[Math.floor(Math.random() * outcomes.length)];

  await interaction.reply({ content: `🪙 ${result}`, flags: MessageFlags.Ephemeral });
}
