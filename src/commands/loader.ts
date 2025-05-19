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
      const filePath = path.join(commandsPath, file);
      const command: Command = await import(filePath);
      commands.set(command.data.name, command);
    }
  }

  // Log loaded commands info
  console.log(`[Commands Loader] Loaded ${commands.size} commands:`);
  for (const commandName of commands.keys()) {
    console.log(` - ${commandName}`);
  }

  return commands;
}
