import fs from "fs";
import path from "path";
import { VentryxClient, Command, Event, Worker, LoaderResult } from "../types";

export class Loader {
  private client: VentryxClient;

  constructor(client: VentryxClient) {
    this.client = client;
  }

  async loadCommands(): Promise<LoaderResult> {
    const result: LoaderResult = { success: 0, failed: 0, items: [] };
    const commandsPath = path.join(__dirname, "../commands");

    if (!fs.existsSync(commandsPath)) {
      console.log("📁 Commands folder not found, creating...");
      fs.mkdirSync(commandsPath, { recursive: true });
      return result;
    }

    const commandFiles = fs
      .readdirSync(commandsPath)
      .filter((file) => file.endsWith(".ts") || file.endsWith(".js"));

    for (const file of commandFiles) {
      try {
        const filePath = path.join(commandsPath, file);
        delete require.cache[require.resolve(filePath)];

        const command: Command = require(filePath).default;

        if (!command?.data?.name || !command?.execute) {
          throw new Error("Invalid command structure");
        }

        this.client.commands.set(command.data.name, command);
        result.success++;
        result.items.push(command.data.name);

        console.log(`✅ Loaded command: ${command.data.name}`);
      } catch (error) {
        result.failed++;
        console.error(`❌ Failed to load command ${file}:`, error);
      }
    }

    return result;
  }

  async loadEvents(): Promise<LoaderResult> {
    const result: LoaderResult = { success: 0, failed: 0, items: [] };
    const eventsPath = path.join(__dirname, "../events");

    if (!fs.existsSync(eventsPath)) {
      console.log("📁 Events folder not found, creating...");
      fs.mkdirSync(eventsPath, { recursive: true });
      return result;
    }

    const eventFiles = fs
      .readdirSync(eventsPath)
      .filter((file) => file.endsWith(".ts") || file.endsWith(".js"));

    for (const file of eventFiles) {
      try {
        const filePath = path.join(eventsPath, file);
        delete require.cache[require.resolve(filePath)];

        const event: Event = require(filePath).default;

        if (!event?.name || !event?.execute) {
          throw new Error("Invalid event structure");
        }

        if (event.once) {
          this.client.once(event.name, event.execute);
        } else {
          this.client.on(event.name, event.execute);
        }

        result.success++;
        result.items.push(event.name);

        console.log(`✅ Loaded event: ${event.name}`);
      } catch (error) {
        result.failed++;
        console.error(`❌ Failed to load event ${file}:`, error);
      }
    }

    return result;
  }

  async loadWorkers(): Promise<LoaderResult> {
    const result: LoaderResult = { success: 0, failed: 0, items: [] };
    const workersPath = path.join(__dirname, "../workers");

    if (!fs.existsSync(workersPath)) {
      console.log("📁 Workers folder not found, creating...");
      fs.mkdirSync(workersPath, { recursive: true });
      return result;
    }

    const workerFiles = fs
      .readdirSync(workersPath)
      .filter((file) => file.endsWith(".ts") || file.endsWith(".js"));

    for (const file of workerFiles) {
      try {
        const filePath = path.join(workersPath, file);
        delete require.cache[require.resolve(filePath)];

        const worker: Worker = require(filePath).default;

        if (!worker?.name || !worker?.execute || !worker?.interval) {
          throw new Error("Invalid worker structure");
        }

        // Zatrzymaj poprzedni worker jeśli istnieje
        const existingWorker = this.client.workers.get(worker.name);
        if (existingWorker?.intervalId) {
          clearInterval(existingWorker.intervalId);
        }

        // Ustaw nowy interval
        worker.intervalId = setInterval(async () => {
          try {
            await worker.execute();
          } catch (error) {
            console.error(`❌ Worker ${worker.name} execution failed:`, error);
          }
        }, worker.interval);

        this.client.workers.set(worker.name, worker);
        result.success++;
        result.items.push(worker.name);

        console.log(
          `✅ Loaded worker: ${worker.name} (interval: ${worker.interval}ms)`
        );
      } catch (error) {
        result.failed++;
        console.error(`❌ Failed to load worker ${file}:`, error);
      }
    }

    return result;
  }

  async reloadAll(): Promise<void> {
    console.log("🔄 Reloading all modules...");

    const commands = await this.loadCommands();
    const events = await this.loadEvents();
    const workers = await this.loadWorkers();

    console.log(`📊 Reload Summary:
Commands: ${commands.success}/${commands.success + commands.failed} loaded
Events: ${events.success}/${events.success + events.failed} loaded
Workers: ${workers.success}/${workers.success + workers.failed} loaded`);
  }
}
