import dotenv from 'dotenv';
import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  Collection,
  Partials
} from 'discord.js';

// ---- Import functions from your i18n module ----
// Adjust the path if your i18n file is located elsewhere (e.g., './lib/i18n')
import { initializeI18n, t } from './lib/i18n'; // Assuming i18n.ts is in src/lib/

import { loadCommands } from './commands/loader';
import { loadEvents } from './events/loader';
import { loadWorkers } from './workers/loader';

dotenv.config();

async function main() {
  // ---- Call i18n initialization FIRST THING ----
  initializeI18n();
  // -----------------------------------------------

  const token = process.env.TOKEN;
  const clientId = process.env.CLIENT_ID;
  const guildId = process.env.GUILD_ID; // Can be undefined if not set
  const DEBUG = process.env.DEBUG === 'true';

  if (!token) {
    console.error("ERROR: Bot token (TOKEN) not found in .env file. Exiting.");
    process.exit(1);
  }
  if (!clientId) {
    console.error("ERROR: Client ID (CLIENT_ID) not found in .env file. Exiting.");
    process.exit(1);
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMessageReactions,
    ],
    partials: [Partials.Channel, Partials.Message, Partials.Reaction, Partials.User, Partials.GuildMember],
  });

  // Now, when you load commands, and they import and use `t`,
  // the i18n system should already be initialized.
  const commands: Collection<string, any> = await loadCommands(); // Assuming loadCommands is async
  (client as any).commands = commands;

  await loadEvents(client);
  await loadWorkers(client);

  const rest = new REST({ version: '10' }).setToken(token);

  try {
    console.log(t('logs.command_registration.started', { defaultValue: 'Started refreshing application (/) commands.' })); // Example usage of t
    const commandData = commands.map(cmd => cmd.data.toJSON());

    if (guildId) {
      await rest.put(
          Routes.applicationGuildCommands(clientId, guildId),
          { body: commandData },
      );
      console.log(t('logs.command_registration.guild_success', { guildId: guildId, defaultValue: `Successfully reloaded application (/) commands for guild ${guildId}.` }));
    } else {
      await rest.put(
          Routes.applicationCommands(clientId),
          { body: commandData },
      );
      console.log(t('logs.command_registration.global_success', { defaultValue: 'Successfully reloaded global application (/) commands.' }));
    }

    if (DEBUG) {
      console.warn(t('logs.debug_mode_enabled', { defaultValue: '🛠️ Debug mode is ENABLED.' }));
    }
  } catch (error) {
    console.error(t('errors.command_registration_failed', { defaultValue: '[Command Registration Error]' }), error);
  }

  client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    // It's good practice to ensure 'commands' is properly attached to client
    const clientCommands = (interaction.client as any).commands as Collection<string, any> | undefined;
    if (!clientCommands) {
      console.error("Client commands collection not found on interaction.client.");
      await interaction.reply({ content: t('errors.unexpected', {defaultValue: 'An unexpected error occurred.'}), ephemeral: true });
      return;
    }

    const command = clientCommands.get(interaction.commandName);
    if (!command) {
      console.error(`Command ${interaction.commandName} not found.`);
      // Optionally inform the user, though Discord usually handles unknown commands.
      // await interaction.reply({ content: t('errors.command_not_found', { commandName: interaction.commandName }), ephemeral: true });
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(t('errors.command_execution_error_log', { commandName: interaction.commandName, defaultValue: `Error executing command ${interaction.commandName}:` }), error);
      // Provide a translated error message to the user
      await interaction.reply({ content: t('errors.command_execution_failed_user', {defaultValue: 'There was an error while executing this command!'}), ephemeral: true });
    }
  });

  await client.login(token);
  // console.log(t('logs.bot_logged_in', { username: client.user?.tag })); // Moved after login to ensure client.user is available
}

main().catch(error => {
  // Use t() here if i18n is initialized before this catch can happen (it should be)
  // Or use a plain string if you're unsure about i18n state in a top-level catch.
  console.error("Unhandled error in main function:", error);
  process.exit(1); // Exit with an error code
});