import "dotenv/config";
import { REST, Routes } from "discord.js";

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

if (!DISCORD_TOKEN || !CLIENT_ID || !GUILD_ID) {
  throw new Error(
    "Missing required environment variables: DISCORD_TOKEN, CLIENT_ID, or GUILD_ID"
  );
}

const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

async function clearCommands() {
  try {
    console.log(
      "🧹 Starting to clear application (/) commands for the guild..."
    );

    await rest.put(Routes.applicationGuildCommands(CLIENT_ID!, GUILD_ID!), {
      body: [],
    });

    console.log(
      "✅ Successfully cleared application (/) commands for the guild."
    );

    console.log('🧹 Starting to clear GLOBAL application (/) commands...');
    await rest.put(Routes.applicationCommands(CLIENT_ID!), {
      body: [],
    });
    console.log('✅ Successfully cleared GLOBAL application (/) commands.');
  } catch (error) {
    console.error("❌ An error occurred while clearing commands:", error);
  }
}

clearCommands();