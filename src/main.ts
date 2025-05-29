import dotenv from 'dotenv';
import {Client, GatewayIntentBits, REST, Routes, Collection, Partials} from 'discord.js';
import { loadCommands } from './commands/loader';
import { loadEvents } from './events/loader';
import { loadWorkers } from './workers/loader';

dotenv.config();

async function main() {
  const token = process.env.TOKEN!;
  const clientId = process.env.CLIENT_ID!;
  const guildId = process.env.GUILD_ID;
  const DEBUG = process.env.DEBUG === 'true';

  const client = new Client({ intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMessageReactions,
    ],
    partials: [Partials.Channel, Partials.Message, Partials.Reaction, Partials.User, Partials.GuildMember],
  });
  const commands: Collection<string, any> = await loadCommands();
  (client as any).commands = commands;

  await loadEvents(client);
  await loadWorkers(client);

  const rest = new REST({ version: '10' }).setToken(token);

  try {
    console.log('Registering slash commands...');
    const commandData = commands.map(cmd => cmd.data.toJSON());

    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commandData });
      console.log(`Slash commands registered in guild ${guildId}`);
    } else {
      await rest.put(Routes.applicationCommands(clientId), { body: commandData });
      console.log('Slash commands registered globally');
    }

    if (DEBUG) {
      console.warn('🛠️ Debug mode is ENABLED.');
    }
  } catch (error) {
    console.error('[Command Registration Error]', error);
  }

  client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error('[Command Execution Error]', error);
      await interaction.reply({ content: 'Error executing command.', ephemeral: true });
    }
  });

  await client.login(token);
}

main();
