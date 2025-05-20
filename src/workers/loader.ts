import fs from 'fs';
import path from 'path';
import { Client } from 'discord.js';

export async function loadWorkers(client: Client) {
  const workersPath = __dirname;
  const files = await fs.promises.readdir(workersPath);
  const workers: ((client: Client) => Promise<void>)[] = [];

  for (const file of files) {
    if (file.endsWith('.ts') && file !== 'loader.ts') {
      const filePath = path.join(workersPath, file);
      const { run } = await import(filePath);

      if (typeof run === 'function') {
        workers.push(run);
      }
    }
  }

  console.log(`[Workers Loader] Loaded ${workers.length} worker(s).`);

  setInterval(() => {
    for (const runWorker of workers) {
      runWorker(client).catch(err => console.error('[Worker Error]', err));
    }
  }, 60 * 1000); // every minute

  for (const runWorker of workers) {
    try {
      await runWorker(client);
    } catch (error) {
      console.error('[Worker Error]', error);
    }
  }
}
