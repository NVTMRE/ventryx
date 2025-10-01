// src/index.ts

import {
  Client,
  GatewayIntentBits,
  Collection,
  REST,
  Routes,
  Partials, // WAŻNE
} from "discord.js";
import dotenv from "dotenv";
import { VentryxClient } from "./types";
import { Loader } from "./utils/loader";
import { connectDatabase, disconnectDatabase } from "./database/connection";
import { Connectors, Shoukaku } from "shoukaku";
import { XPManager } from "./managers/xp-manager";

dotenv.config();

const lavalinkNodes = [
  {
    name: "default-node",
    url: `${process.env.LAVALINK_HOST}:${process.env.LAVALINK_PORT}`,
    auth: process.env.LAVALINK_PASSWORD!,
    secure: process.env.LAVALINK_SECURE === "true",
  },
];

class VentryxBot {
  private client: VentryxClient;
  private loader: Loader;
  private rest: REST;
  private shoukaku: Shoukaku;

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessageReactions, // DODANA INTENCJA
      ],
      partials: [Partials.Message, Partials.Channel, Partials.Reaction], // DODANE PARTIALE
    }) as VentryxClient;

    this.shoukaku = new Shoukaku(
      new Connectors.DiscordJS(this.client),
      lavalinkNodes,
      {
        moveOnDisconnect: false,
        resume: false,
        resumeTimeout: 30,
        reconnectTries: 2,
        restTimeout: 10000,
      }
    );

    this.client.shoukaku = this.shoukaku;
    (global as any).__ventryxClient = this.client;

    this.client.commands = new Collection();
    this.client.workers = new Collection();

    this.loader = new Loader(this.client);
    this.rest = new REST({ version: "10" }).setToken(
      process.env.DISCORD_TOKEN!
    );

    this.setupEventHandlers();
    this.setupShoukakuHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on("interactionCreate", async (interaction) => {
      if (!interaction.isChatInputCommand()) return;

      const command = this.client.commands.get(interaction.commandName);
      if (!command) {
        console.error(`❌ Command ${interaction.commandName} not found`);
        return;
      }

      try {
        await command.execute(interaction);
      } catch (error) {
        console.error(
          `❌ Error executing command ${interaction.commandName}:`,
          error
        );

        const errorMessage = "Wystąpił błąd podczas wykonywania tej komendy!";
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({
            content: errorMessage,
            ephemeral: true,
          });
        } else {
          await interaction.reply({ content: errorMessage, ephemeral: true });
        }
      }
    });

    process.on("SIGINT", this.shutdown.bind(this));
    process.on("SIGTERM", this.shutdown.bind(this));
  }

  private setupShoukakuHandlers(): void {
    this.shoukaku.on("ready", (name, reconnected) =>
      console.log(
        `✅ Lavalink node "${name}" is now ${
          reconnected ? "reconnected" : "connected"
        }.`
      )
    );

    this.shoukaku.on("error", (name, error) =>
      console.error(`❌ Lavalink node "${name}" encountered an error:`, error)
    );

    this.shoukaku.on("close", (name, code, reason) =>
      console.log(
        `🚪 Lavalink node "${name}" closed with code ${code}. Reason: ${
          reason || "No reason"
        }`
      )
    );

    this.shoukaku.on("debug", (name, info) => {
      if (process.env.NODE_ENV === "development") {
        console.log(`🔎 Lavalink node "${name}" debug:`, info);
      }
    });
  }

  private async deployCommands(): Promise<void> {
    try {
      console.log("🚀 Deploying slash commands...");

      const commands = Array.from(this.client.commands.values()).map((cmd) =>
        cmd.data.toJSON()
      );

      if (process.env.GUILD_ID) {
        await this.rest.put(
          Routes.applicationGuildCommands(
            this.client.user!.id,
            process.env.GUILD_ID
          ),
          { body: commands }
        );
        console.log(
          `✅ Successfully deployed ${commands.length} commands to guild ${process.env.GUILD_ID}`
        );
      } else {
        await this.rest.put(Routes.applicationCommands(this.client.user!.id), {
          body: commands,
        });
        console.log(
          `✅ Successfully deployed ${commands.length} commands globally`
        );
      }
    } catch (error) {
      console.error("❌ Failed to deploy commands:", error);
    }
  }

  public async start(): Promise<void> {
    try {
      console.log("🤖 Starting Ventryx Bot...");
      XPManager.getInstance();
      console.log("✅ XPManager initialized");

      await connectDatabase();
      await this.loader.reloadAll();
      await this.client.login(process.env.DISCORD_TOKEN);

      this.client.once("ready", (c) => {
        console.log(`✅ Logged in as ${c.user.tag}`);
        this.deployCommands();
      });

      console.log("✅ Ventryx Bot started successfully!");
    } catch (error) {
      console.error("❌ Failed to start bot:", error);
      process.exit(1);
    }
  }

  private async shutdown(): Promise<void> {
    console.log("🔄 Shutting down Ventryx Bot...");

    try {
      const xpManager = XPManager.getInstance();
      const result = await xpManager.flush();
      console.log(
        `💾 Final XP flush: ${result.xpUpdates} updates, ${result.voiceUpdates} voice updates`
      );
    } catch (error) {
      console.error("❌ Error flushing XP on shutdown:", error);
    }

    for (const worker of this.client.workers.values()) {
      if (worker.intervalId) {
        clearInterval(worker.intervalId);
      }
    }

    this.client.destroy();
    await disconnectDatabase();

    console.log("👋 Ventryx Bot shutdown complete");
    process.exit(0);
  }
}

const bot = new VentryxBot();
bot.start();

export { VentryxBot };
