import {
  Client,
  SlashCommandBuilder,
  CommandInteraction,
  ClientEvents,
  SlashCommandSubcommandsOnlyBuilder,
  ChatInputCommandInteraction,
  SlashCommandOptionsOnlyBuilder,
} from "discord.js";
import { Shoukaku } from "shoukaku";

export interface VentryxClient extends Client {
  commands: Map<string, Command>;
  workers: Map<string, Worker>;
  shoukaku: Shoukaku;
}

export interface Command {
  data:
    | SlashCommandBuilder
    | SlashCommandSubcommandsOnlyBuilder
    | SlashCommandOptionsOnlyBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

export interface Event {
  name: keyof ClientEvents;
  once?: boolean;
  execute: (...args: any[]) => Promise<void>;
}

export interface Worker {
  name: string;
  interval: number; // w milisekundach
  execute: () => Promise<void>;
  intervalId?: NodeJS.Timeout;
}

export interface LoaderResult {
  success: number;
  failed: number;
  items: string[];
}

export interface Track {
  encoded: string;
  info: {
    uri: string | undefined;
    title: string;
    length: number;
    author: string;
    position: number;
    artworkUrl?: string;
    identifier?: string;
    isStream?: boolean;
    isSeekable?: boolean;
    sourceName?: string;
  };
}

export interface MusicQueue {
  tracks: Track[];
  currentTrack: Track | null;
  autoplay: boolean;
  autoplayTracks: Track[];
  isProcessing: boolean;
}
