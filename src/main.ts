import dotenv from 'dotenv';
import { Client, GatewayIntentBits, REST, Routes, Collection } from 'discord.js';
import { loadCommands } from './commands/loader';
import { loadEvents } from './events/loader';

dotenv.config();

async function main() {
  const token = process.env.TOKEN!;
  const clientId = process.env.CLIENT_ID!;
  const guildId = process.env.GUILD_ID; // może być undefined
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  const commands: Collection<string, any> = await loadCommands();
  (client as any).commands = commands;

  await loadEvents(client);

  const rest = new REST({ version: '10' }).setToken(token);

  try {
    console.log('Registering slash commands...');

    if (guildId) {
      // Register commands *guild-specific* (faster update, tylko na 1 serwerze)
      await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: commands.map(cmd => cmd.data.toJSON()) }
      );
      console.log(`Slash commands registered in guild ${guildId}`);
    } else {
      // Register commands *globally* (może trwać do godziny, ale dostępne wszędzie)
      await rest.put(
        Routes.applicationCommands(clientId),
        { body: commands.map(cmd => cmd.data.toJSON()) }
      );
      console.log('Slash commands registered globally');
    }
  } catch (error) {
    console.error(error);
  }

  client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(error);
      await interaction.reply({ content: 'Error executing command.', ephemeral: true });
    }
  });

  await client.login(token);
}

main();
