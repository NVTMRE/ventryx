import dotenv from 'dotenv';
import { REST, Routes } from 'discord.js';

// Load environment variables from .env file
dotenv.config();

async function clearApplicationCommands() {
    const token = process.env.TOKEN;
    const clientId = process.env.CLIENT_ID;
    const guildId = process.env.GUILD_ID; // Optional, if you want to clear commands only for a specific guild

    if (!token) {
        console.error('ERROR: TOKEN variable is not defined in the .env file.');
        process.exit(1); // Exit script with an error code
    }
    if (!clientId) {
        console.error('ERROR: CLIENT_ID variable is not defined in the .env file.');
        process.exit(1); // Exit script with an error code
    }

    const rest = new REST({ version: '10' }).setToken(token);

    try {
        if (guildId) {
            // Delete commands for a specific guild
            console.log(`Starting to delete all application (/) commands for guild: ${guildId}...`);
            await rest.put(
                Routes.applicationGuildCommands(clientId, guildId),
                { body: [] }, // An empty array deletes all commands for this guild
            );
            console.log(`Successfully deleted all application (/) commands for guild: ${guildId}.`);
        } else {
            // Delete global commands
            console.log('Starting to delete all global application (/) commands...');
            await rest.put(
                Routes.applicationCommands(clientId),
                { body: [] }, // An empty array deletes all global commands
            );
            console.log('Successfully deleted all global application (/) commands.');
            console.warn('Note: Propagation of changes for global commands can take up to an hour.');
        }
    } catch (error) {
        console.error('An error occurred while clearing application commands:', error);
    }
}

// Run the clearing function
clearApplicationCommands();