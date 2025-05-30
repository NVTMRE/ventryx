import { Client } from 'discord.js';

export function register(client: Client) {
  client.once('ready', () => {
    console.log(`🤖 Logged in as ${client.user?.tag}!`);
  });
}
