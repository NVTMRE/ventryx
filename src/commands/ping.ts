import {ChatInputCommandInteraction, PermissionsBitField, SlashCommandBuilder} from 'discord.js';
import { t } from '../lib/i18n';

export const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription(t('commands.ping.description'))
  .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  // Send an initial reply and fetch the message to measure latency
  const sent = await interaction.reply({ content: '🏓 Pinging...', fetchReply: true, ephemeral: true });

  // Calculate the round-trip latency between the interaction and the bot's reply
  const latency = sent.createdTimestamp - interaction.createdTimestamp;

  // Get the current WebSocket heartbeat ping
  const wsPing = interaction.client.ws.ping;

  // Edit the initial reply with the final ping information
  await interaction.editReply(
    t('commands.ping.response', {
      latency: `${latency}`,
      websocket: `${wsPing}`
    })
  );
}
