import fs from 'fs';
import path from 'path';
import { Collection } from 'discord.js';

interface Command {
  data: any;
  execute: Function;
}

export async function loadCommands(): Promise<Collection<string, Command>> {
  const commands = new Collection<string, Command>();
  const commandsPath = path.join(__dirname);
  const files = await fs.promises.readdir(commandsPath);

  for (const file of files) {
    if (file.endsWith('.ts') && file !== 'loader.ts') {
      // If weather command, check env variable to decide
      if (file === 'weather.ts' && !process.env.OPENWEATHER_API_KEY) {
        console.log('[Commands Loader] Skipping weather command because OPENWEATHER_API_KEY is missing.');
        continue;
      }

      const filePath = path.join(commandsPath, file);
      const command: Command = await import(filePath);
      commands.set(command.data.name, command);
    }
  }

  // Log loaded commands info
  process.env.DEBUG && console.log(`[Commands Loader] Loaded ${commands.size} commands:`);
  for (const commandName of commands.keys()) {
    process.env.DEBUG && console.log(` - ${commandName}`);
  }

  return commands;
}
