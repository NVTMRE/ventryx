import fs from 'fs';
import path from 'path';
import { Client } from 'discord.js';

export async function loadEvents(client: Client) {
  const eventsPath = path.join(__dirname);
  const files = await fs.promises.readdir(eventsPath);

  const loadedEvents: string[] = [];

  for (const file of files) {
    if (file.endsWith('.ts') && file !== 'loader.ts') {
      const filePath = path.join(eventsPath, file);
      const eventModule = await import(filePath);
      eventModule.register(client);

      // Use filename (without .ts) as event name
      loadedEvents.push(path.basename(file, '.ts'));
    }
  }

  // Log loaded events info
  console.log(`[Events Loader] Loaded ${loadedEvents.length} events:`);
  for (const eventName of loadedEvents) {
    console.log(` - ${eventName}`);
  }
}
