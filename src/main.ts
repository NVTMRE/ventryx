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
    const errorMsg = t('errors.env.token_missing', { defaultValue: "ERROR: Bot token (TOKEN) not found in .env file. Exiting." });
    console.error(errorMsg);
    process.exit(1);
  }
  if (!clientId) {
    const errorMsg = t('errors.env.client_id_missing', { defaultValue: "ERROR: Client ID (CLIENT_ID) not found in .env file. Exiting." });
    console.error(errorMsg);
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

  console.log(t('logs.loading.commands', { defaultValue: "Loading commands..." }));
  const commands: Collection<string, any> = await loadCommands();
  (client as any).commands = commands;
  console.log(t('logs.loading.commands_done', { count: commands.size, defaultValue: `Loaded ${commands.size} commands.` }));


  console.log(t('logs.loading.events', { defaultValue: "Loading events..." }));
  await loadEvents(client);

  console.log(t('logs.loading.workers', { defaultValue: "Loading workers..." }));
  await loadWorkers(client);

  const rest = new REST({ version: '10' }).setToken(token);

  try {
    console.log(t('logs.command_registration.started', { defaultValue: 'Started refreshing application (/) commands.' }));

    console.log('[DEBUG] Preparing command data for registration...'); // <--- NEW DEBUG LOG
    const commandData = commands.map(cmd => {
      if (!cmd.data || typeof cmd.data.toJSON !== 'function') {
        const errorMsg = t('errors.command_malformed', { commandName: cmd.name || 'UNKNOWN_CMD', defaultValue: `Command data for "${cmd.name || 'UNKNOWN_CMD'}" is malformed or missing toJSON method.` });
        console.error(errorMsg);
        throw new Error(errorMsg); // Stop if a command is malformed
      }
      return cmd.data.toJSON();
    });
    console.log(`[DEBUG] Command data prepared. Number of commands: ${commandData.length}`); // <--- NEW DEBUG LOG
    // Uncomment to see the full JSON data (can be very long)
    // if (DEBUG) {
    //     console.log('[DEBUG] Command data JSON (first command):', commandData.length > 0 ? JSON.stringify(commandData[0], null, 2) : "No commands to register.");
    // }


    if (guildId) {
      console.log(`[DEBUG] Attempting to register ${commandData.length} commands for guild: ${guildId}`); // <--- NEW DEBUG LOG
      await rest.put(
          Routes.applicationGuildCommands(clientId, guildId),
          { body: commandData },
      );
      console.log(t('logs.command_registration.guild_success', { guildId: guildId, defaultValue: `Successfully reloaded application (/) commands for guild ${guildId}.` }));
    } else {
      console.log(`[DEBUG] Attempting to register ${commandData.length} commands globally.`); // <--- NEW DEBUG LOG
      await rest.put(
          Routes.applicationCommands(clientId),
          { body: commandData },
      );
      console.log(t('logs.command_registration.global_success', { defaultValue: 'Successfully reloaded global application (/) commands.' }));
    }
    console.log('[DEBUG] Command registration API call seems to have completed.'); // <--- NEW DEBUG LOG

    if (DEBUG) {
      console.warn(t('logs.debug_mode_enabled', { defaultValue: '🛠️ Debug mode is ENABLED.' }));
    }
  } catch (error: any) { // Explicitly type error as any or unknown then check
    const errorMessageKey = 'errors.command_registration_failed';
    const defaultErrorMessage = '[Command Registration Error]';
    let translatedMessage = defaultErrorMessage;
    try {
      translatedMessage = t(errorMessageKey, { defaultValue: defaultErrorMessage });
    } catch (tError) {
      console.error("Error while translating main error message for command registration failure:", tError);
    }
    console.error(translatedMessage, error); // Log the original error

    // Log more details if available from discord.js error
    if (error && typeof error === 'object') {
      if ('status' in error) console.error(`[DEBUG] HTTP Status: ${error.status}`);
      if ('method' in error) console.error(`[DEBUG] HTTP Method: ${error.method}`);
      if ('url' in error) console.error(`[DEBUG] URL: ${error.url}`);
      if ('rawError' in error) { // For DiscordAPIError
        console.error('[DEBUG] Raw error from Discord API:', (error as any).rawError);
      } else if ('errors' in error) { // For RESTJSONErrorCodes. lichaam
        console.error('[DEBUG] Detailed validation errors:', (error as any).errors);
      }
    }
    // process.exit(1); // Optionally exit if registration fails
  }

  client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const clientCommands = (interaction.client as any).commands as Collection<string, any> | undefined;
    if (!clientCommands) {
      console.error(t('errors.internal.client_commands_missing', { defaultValue: "Client commands collection not found on interaction.client." }));
      try {
        await interaction.reply({ content: t('errors.unexpected_user', { defaultValue: 'An unexpected error occurred processing your command.' }), ephemeral: true });
      } catch (replyError) {
        console.error(t('errors.internal.reply_failed', {defaultValue: "Failed to send error reply to interaction:"}), replyError);
      }
      return;
    }

    const command = clientCommands.get(interaction.commandName);
    if (!command) {
      console.error(t('errors.command_not_found_log', { commandName: interaction.commandName, defaultValue: `Command ${interaction.commandName} not found in collection.` }));
      try {
        await interaction.reply({ content: t('errors.command_not_found_user', { commandName: interaction.commandName, defaultValue: `The command '${interaction.commandName}' could not be found.` }), ephemeral: true });
      } catch (replyError) {
        console.error(t('errors.internal.reply_failed', {defaultValue: "Failed to send error reply to interaction:"}), replyError);
      }
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(t('errors.command_execution_error_log', { commandName: interaction.commandName, defaultValue: `Error executing command ${interaction.commandName}:` }), error);
      try {
        await interaction.reply({ content: t('errors.command_execution_failed_user', { defaultValue: 'There was an error while executing this command!' }), ephemeral: true });
      } catch (replyError) {
        console.error(t('errors.internal.reply_failed', {defaultValue: "Failed to send error reply to interaction:"}), replyError);
      }
    }
  });

  try {
    console.log(t('logs.bot_logging_in', {defaultValue: "Logging in to Discord..."}));
    await client.login(token);
    // The "Bot logged in as..." message is best placed in the 'ready' event handler (e.g., in your on-ready.ts)
    // as client.user might not be populated immediately after client.login() resolves.
    console.log('[DEBUG] client.login() promise resolved.'); // <--- NEW DEBUG LOG
  } catch (loginError) {
    console.error(t('errors.login_failed', {defaultValue: "Failed to log in to Discord:"}), loginError);
    process.exit(1);
  }
}

main().catch(error => {
  console.error(">>> CRITICAL UNHANDLED ERROR IN MAIN FUNCTION <<<", error);
  process.exit(1);
});