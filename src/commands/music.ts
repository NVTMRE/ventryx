import {
  SlashCommandBuilder,
  CommandInteraction,
  EmbedBuilder,
  GuildMember,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import { Command, VentryxClient } from "../types";
import { LoadType, Track } from "shoukaku";

enum RepeatMode {
  NONE,
  TRACK,
  QUEUE,
}

// Interfejs dla kolejki muzycznej
interface MusicQueue {
  tracks: Track[]; // Główne utwory dodane przez użytkowników
  autoplayTracks: Track[]; // Utwory z autoplay - zawsze na końcu
  currentTrack: Track | null;
  autoplay: boolean;
  repeat: RepeatMode;
  isShuffled: boolean;
  isPaused: boolean;
}

// Mapa kolejek dla każdego serwera
const queues = new Map<string, MusicQueue>();
const autoplayStates = new Map<string, boolean>();

// Funkcja do zarządzania stanem autoplay
function manageAutoplayState(guildId: string, state?: boolean): boolean {
  if (state !== undefined) {
    autoplayStates.set(guildId, state);
  }
  return autoplayStates.get(guildId) || false;
}

// Funkcja pomocnicza do pobrania lub utworzenia kolejki
function getQueue(guildId: string): MusicQueue {
  if (!queues.has(guildId)) {
    queues.set(guildId, {
      tracks: [],
      currentTrack: null,
      autoplay: manageAutoplayState(guildId),
      autoplayTracks: [],
      repeat: RepeatMode.NONE,
      isShuffled: false,
      isPaused: false,
    });
  }
  const queue = queues.get(guildId)!;
  queue.autoplay = manageAutoplayState(guildId);
  return queue;
}

// Funkcja do pobierania łącznej długości kolejki
function getTotalQueueLength(queue: MusicQueue): number {
  return queue.tracks.length + queue.autoplayTracks.length;
}

// Funkcja do pobierania następnego utworu z kolejki
function getNextTrack(queue: MusicQueue): Track | null {
  // Najpierw sprawdź główną kolejkę
  if (queue.tracks.length > 0) {
    return queue.tracks.shift()!;
  }
  // Jeśli główna kolejka jest pusta, weź z autoplay
  if (queue.autoplayTracks.length > 0) {
    return queue.autoplayTracks.shift()!;
  }
  return null;
}

// Funkcja do pobierania podobnych utworów
async function fetchSimilarTracks(
  client: VentryxClient,
  track: Track
): Promise<Track[]> {
  const node = client.shoukaku.getIdealNode();
  if (!node) return [];

  try {
    const result = await node.rest.resolve(`ytsearch:${track.info.author}`);

    if (result?.loadType === LoadType.SEARCH) {
      // Filtruj, aby uniknąć powtórzeń i obecnego utworu
      const filteredTracks = result.data.filter(
        (t) =>
          t.info?.uri &&
          t.info.uri !== track.info.uri &&
          !t.info.uri.includes("playlist")
      );

      // Zwróć maksymalnie 3 losowe utwory
      return filteredTracks.sort(() => Math.random() - 0.5).slice(0, 3);
    }
  } catch (error) {
    console.error("Błąd podczas pobierania podobnych utworów:", error);
  }

  return [];
}

// Funkcja do ustawiania filtrów audio
async function applyAudioFilters(player: any) {
  await player.setFilters({
    equalizer: [
      { band: 0, gain: 0.1 }, // 25 Hz - sub-bass
      { band: 1, gain: 0.1 }, // 40 Hz - bass
      { band: 2, gain: 0.05 }, // 63 Hz
      { band: 3, gain: 0 }, // 100 Hz
      { band: 4, gain: 0 }, // 160 Hz
      { band: 5, gain: 0 }, // 250 Hz - low mids
      { band: 6, gain: 0 }, // 400 Hz
      { band: 7, gain: 0.05 }, // 630 Hz - presence
      { band: 8, gain: 0.05 }, // 1 kHz - vocals
      { band: 9, gain: 0.05 }, // 1.6 kHz
      { band: 10, gain: 0.05 }, // 2.5 kHz - clarity
      { band: 11, gain: 0.05 }, // 4 kHz - presence
      { band: 12, gain: 0.1 }, // 6.3 kHz - brilliance
      { band: 13, gain: 0.1 }, // 10 kHz - air
      { band: 14, gain: 0.05 }, // 16 kHz - sparkle
    ],
  });
}

// Funkcja do tworzenia przycisków kontrolnych odtwarzacza
function createPlayerControls(
  queue: MusicQueue
): ActionRowBuilder<ButtonBuilder>[] {
  // Pierwszy rząd przycisków - główne kontrolki
  const mainControls = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(queue.isPaused ? "play" : "pause")
      .setEmoji(queue.isPaused ? "▶️" : "⏸️")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("stop")
      .setEmoji("⏹️")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("skip")
      .setEmoji("⏭️")
      .setStyle(ButtonStyle.Secondary)
  );

  // Drugi rząd przycisków - dodatkowe funkcje
  const additionalControls =
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("shuffle")
        .setEmoji("🔀")
        .setStyle(
          queue.isShuffled ? ButtonStyle.Success : ButtonStyle.Secondary
        ),
      new ButtonBuilder()
        .setCustomId("repeat")
        .setEmoji(
          queue.repeat === RepeatMode.NONE
            ? "🔁"
            : queue.repeat === RepeatMode.TRACK
            ? "🔂"
            : "🔜"
        )
        .setStyle(
          queue.repeat === RepeatMode.NONE
            ? ButtonStyle.Secondary
            : ButtonStyle.Success
        ),
      new ButtonBuilder()
        .setCustomId("autoplay")
        .setEmoji("📻")
        .setStyle(queue.autoplay ? ButtonStyle.Success : ButtonStyle.Secondary)
    );

  return [mainControls, additionalControls];
}

// Funkcja do aktualizacji wiadomości z odtwarzaczem
async function updatePlayerMessage(
  interaction: CommandInteraction,
  queue: MusicQueue
) {
  if (!queue.currentTrack) return;

  const totalTracks = getTotalQueueLength(queue);

  const embed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle("Odtwarzacz muzyki")
    .setDescription(
      `🎵 **Aktualnie odtwarzane:**\n[${queue.currentTrack.info.title}](${queue.currentTrack.info.uri})`
    )
    .addFields(
      { name: "Autor", value: queue.currentTrack.info.author, inline: true },
      {
        name: "Status",
        value: `${queue.isPaused ? "⏸️ Pauza" : "▶️ Odtwarzanie"} | ${
          queue.repeat === RepeatMode.NONE
            ? "🔁 Wył."
            : queue.repeat === RepeatMode.TRACK
            ? "🔂 Utwór"
            : "🔜 Kolejka"
        }`,
        inline: true,
      },
      {
        name: "Kolejka",
        value: `${queue.tracks.length} utworów${
          queue.autoplayTracks.length > 0
            ? ` + ${queue.autoplayTracks.length} autoplay`
            : ""
        }${queue.isShuffled ? " (pomieszana)" : ""}`,
        inline: true,
      }
    )
    .setTimestamp();

  if (queue.currentTrack.info.artworkUrl) {
    embed.setThumbnail(queue.currentTrack.info.artworkUrl);
  }

  const controls = createPlayerControls(queue);

  if (interaction.replied || interaction.deferred) {
    await interaction.editReply({ embeds: [embed], components: controls });
  } else {
    await interaction.reply({ embeds: [embed], components: controls });
  }
}

// Funkcja do odtwarzania następnego utworu
async function playNext(client: VentryxClient, guildId: string, player: any) {
  const queue = getQueue(guildId);

  // Jeśli włączone jest powtarzanie pojedynczego utworu
  if (queue.repeat === RepeatMode.TRACK && queue.currentTrack) {
    await player.playTrack({ track: { encoded: queue.currentTrack.encoded } });
    await applyAudioFilters(player);
    return;
  }

  // Pobierz następny utwór (najpierw z głównej kolejki, potem z autoplay)
  const nextTrack = getNextTrack(queue);

  if (nextTrack) {
    queue.currentTrack = nextTrack;
    await player.playTrack({ track: { encoded: nextTrack.encoded } });
    await applyAudioFilters(player);
  } else if (queue.autoplay && queue.currentTrack) {
    try {
      // Pobierz podobny utwór do ostatnio odtwarzanego
      const node = client.shoukaku.getIdealNode();
      if (!node) return;

      const result = await node.rest.resolve(
        `ytsearch:${queue.currentTrack.info.author}`
      );

      if (result?.loadType === LoadType.SEARCH && result.data.length > 0) {
        // Pobierz losowy utwór z pierwszych 5 wyników
        const randomIndex = Math.floor(
          Math.random() * Math.min(5, result.data.length)
        );
        const similarTrack = result.data[randomIndex];
        queue.currentTrack = similarTrack;
        await player.playTrack({ track: { encoded: similarTrack.encoded } });
        await applyAudioFilters(player);
      }
    } catch (error) {
      console.error("Błąd podczas autoplay:", error);
    }
  } else {
    // Jeśli nie ma więcej utworów i autoplay jest wyłączone, zakończ
    queue.currentTrack = null;
    await player.destroy();
  }
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("music")
    .setDescription("Główna komenda dla funkcji muzycznych")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("play")
        .setDescription("Odtwarza piosenkę z YouTube lub SoundCloud")
        .addStringOption((option) =>
          option
            .setName("query")
            .setDescription("Link lub nazwa piosenki")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("stop")
        .setDescription("Zatrzymuje aktualnie odtwarzaną muzykę")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("skip")
        .setDescription("Pomija aktualnie odtwarzany utwór")
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("queue").setDescription("Wyświetla kolejkę utworów")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("autoplay")
        .setDescription(
          "Włącza/wyłącza automatyczne odtwarzanie podobnych utworów"
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("clear").setDescription("Czyści kolejkę utworów")
    ),

  execute: async (interaction: CommandInteraction): Promise<void> => {
    if (!interaction.isChatInputCommand()) return;

    const subcommand = interaction.options.getSubcommand();
    const client = interaction.client as VentryxClient;
    const member = interaction.member as GuildMember;

    if (subcommand === "stop") {
      const voiceChannel = member.voice.channel;
      if (!voiceChannel) {
        await interaction.reply({
          content: "Musisz być na kanale głosowym, aby użyć tej komendy!",
          flags: [MessageFlags.Ephemeral],
        });
        return;
      }

      const player = client.shoukaku.players.get(interaction.guildId!);
      if (!player) {
        await interaction.reply({
          content: "Aktualnie nie odtwarzam żadnej muzyki!",
          flags: [MessageFlags.Ephemeral],
        });
        return;
      }

      // Zachowaj stan autoplay przed zatrzymaniem
      const queue = getQueue(interaction.guildId!);
      const wasAutoplayEnabled = queue.autoplay;

      player.stopTrack();
      await client.shoukaku.leaveVoiceChannel(interaction.guildId!);
      await player.destroy();

      // Utwórz nową kolejkę zachowując stan autoplay
      queues.set(interaction.guildId!, {
        tracks: [],
        currentTrack: null,
        autoplay: wasAutoplayEnabled,
        autoplayTracks: [],
        repeat: RepeatMode.NONE,
        isShuffled: false,
        isPaused: false,
      });

      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setAuthor({ name: "Zatrzymano odtwarzanie" })
        .setDescription("Opuszczam kanał głosowy")
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (subcommand === "skip") {
      const player = client.shoukaku.players.get(interaction.guildId!);
      if (!player) {
        await interaction.reply({
          content: "Aktualnie nie odtwarzam żadnej muzyki!",
          flags: [MessageFlags.Ephemeral],
        });
        return;
      }

      const queue = getQueue(interaction.guildId!);
      let nextTrackInfo = "następny utwór";

      if (queue.tracks.length > 0) {
        nextTrackInfo = queue.tracks[0].info.title;
      } else if (queue.autoplayTracks.length > 0) {
        nextTrackInfo = `${queue.autoplayTracks[0].info.title} (autoplay)`;
      } else if (queue.autoplay) {
        nextTrackInfo = "następny utwór (autoplay)";
      } else {
        nextTrackInfo = "koniec kolejki";
      }

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setAuthor({ name: "Pomijam utwór" })
        .setDescription(`Następnie: ${nextTrackInfo}`)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

      // Zatrzymujemy aktualny utwór, co powinno wywołać event "end"
      await player.stopTrack();
      return;
    }

    if (subcommand === "queue") {
      const queue = getQueue(interaction.guildId!);
      const player = client.shoukaku.players.get(interaction.guildId!);

      if (!player || !queue.currentTrack) {
        await interaction.reply({
          content: "Kolejka jest pusta!",
          flags: [MessageFlags.Ephemeral],
        });
        return;
      }

      // Pokaż do 10 utworów z głównej kolejki
      const mainTracks = queue.tracks.slice(0, 10);
      // Pokaż do 5 utworów z autoplay
      const autoplayTracksToShow = queue.autoplayTracks.slice(0, 5);

      let description = `**Aktualnie odtwarzane:**\n[${queue.currentTrack.info.title}](${queue.currentTrack.info.uri})\n\n`;

      if (mainTracks.length > 0) {
        description += `**Następne utwory:**\n${mainTracks
          .map((t, i) => `${i + 1}. [${t.info.title}](${t.info.uri})`)
          .join("\n")}`;

        if (queue.tracks.length > 10) {
          description += `\n*...i ${queue.tracks.length - 10} więcej*`;
        }
      } else {
        description += "**Kolejka jest pusta**";
      }

      if (autoplayTracksToShow.length > 0) {
        description += `\n\n**Autoplay (${
          queue.autoplayTracks.length
        }):**\n${autoplayTracksToShow
          .map((t, i) => `${i + 1}. [${t.info.title}](${t.info.uri})`)
          .join("\n")}`;

        if (queue.autoplayTracks.length > 5) {
          description += `\n*...i ${queue.autoplayTracks.length - 5} więcej*`;
        }
      }

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setAuthor({ name: "Kolejka utworów" })
        .setDescription(description)
        .addFields({
          name: "Autoplay",
          value: queue.autoplay ? "Włączone" : "Wyłączone",
          inline: true,
        })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (subcommand === "autoplay") {
      const queue = getQueue(interaction.guildId!);
      const newAutoplayState = !queue.autoplay;
      manageAutoplayState(interaction.guildId!, newAutoplayState);
      queue.autoplay = newAutoplayState;

      if (newAutoplayState && queue.currentTrack) {
        await interaction.deferReply();
        // Pobierz podobne utwory w tle
        const similarTracks = await fetchSimilarTracks(
          client,
          queue.currentTrack
        );
        // Dodaj do kolejki autoplay (zawsze na końcu)
        queue.autoplayTracks.push(...similarTracks);

        const embed = new EmbedBuilder()
          .setColor(0x00ff00)
          .setAuthor({ name: "Autoplay włączone" })
          .setDescription("Dodano do kolejki podobne utwory:")
          .addFields(
            similarTracks.map((track, index) => ({
              name: `${index + 1}.`,
              value: `[${track.info.title}](${track.info.uri})`,
              inline: false,
            }))
          )
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      } else {
        // Usuń utwory z autoplay z kolejki
        queue.autoplayTracks = [];

        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setAuthor({ name: "Autoplay wyłączone" })
          .setDescription("Usunięto z kolejki automatycznie dodane utwory")
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
      }
      return;
    }

    if (subcommand === "clear") {
      const queue = getQueue(interaction.guildId!);
      const currentAutoplay = queue.autoplay;
      queue.tracks = [];
      queue.autoplayTracks = [];
      queue.autoplay = currentAutoplay; // Zachowaj stan autoplay

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setAuthor({ name: "Kolejka została wyczyszczona" })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (subcommand === "play") {
      const client = interaction.client as VentryxClient;
      const member = interaction.member as GuildMember;

      const voiceChannel = member.voice.channel;
      if (!voiceChannel) {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: "Musisz być na kanale głosowym, aby użyć tej komendy!",
            flags: [MessageFlags.Ephemeral],
          });
        }
        return;
      }

      const permissions = voiceChannel.permissionsFor(interaction.client.user!);
      if (!permissions) {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: "Nie mogłem zweryfikować moich uprawnień na tym kanale.",
            flags: [MessageFlags.Ephemeral],
          });
        }
        return;
      }
      if (!permissions.has("Connect") || !permissions.has("Speak")) {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content:
              "Nie mam uprawnień, aby dołączyć i mówić na Twoim kanale głosowym!",
            flags: [MessageFlags.Ephemeral],
          });
        }
        return;
      }

      await interaction.deferReply();

      let musicQueue = getQueue(interaction.guildId!);
      const autoplayEnabled = manageAutoplayState(interaction.guildId!);
      musicQueue.autoplay = autoplayEnabled;

      const query = interaction.options.getString("query", true);
      const isUrl = /^https?:\/\//.test(query);
      let result;

      const node = client.shoukaku.getIdealNode();
      if (!node) {
        await interaction.editReply(
          "Nie jestem połączony z żadnym serwerem muzycznym."
        );
        return;
      }

      try {
        if (isUrl) {
          result = await node.rest.resolve(query);
        } else {
          result = await node.rest.resolve(`ytsearch:${query}`);
        }
      } catch (error) {
        console.error("Błąd podczas wyszukiwania:", error);
        await interaction.editReply(
          "Wystąpił błąd podczas wyszukiwania utworu."
        );
        return;
      }
      if (!result) {
        await interaction.editReply(
          "Wystąpił błąd podczas wyszukiwania utworu."
        );
        return;
      }

      let track: Track;
      switch (result.loadType) {
        case LoadType.EMPTY:
        case LoadType.ERROR:
          await interaction.editReply(
            "Nie udało mi się nic znaleźć lub wystąpił błąd."
          );
          return;

        case LoadType.PLAYLIST:
          track = result.data.tracks[0];
          break;

        case LoadType.SEARCH: {
          const tracks = result.data.slice(0, 5);

          const buttons = tracks.map((t, index) =>
            new ButtonBuilder()
              .setCustomId(`select_${index}`)
              .setLabel(`${index + 1}`)
              .setStyle(ButtonStyle.Primary)
          );

          buttons.push(
            new ButtonBuilder()
              .setCustomId("cancel")
              .setLabel("✕ Anuluj")
              .setStyle(ButtonStyle.Danger)
          );

          const embed = new EmbedBuilder()
            .setColor(0x00ff00)
            .setAuthor({ name: "Wyniki wyszukiwania" })
            .setDescription(
              tracks
                .map(
                  (t, i) =>
                    `${i + 1}. [${t.info.title}](${t.info.uri}) - ${
                      t.info.author
                    }`
                )
                .join("\n")
            )
            .setFooter({ text: "Wybierz numer utworu lub kliknij Anuluj" });

          const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
            buttons.slice(0, 5)
          );

          const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
            buttons.slice(5)
          );

          const response = await interaction.editReply({
            embeds: [embed],
            components: [row1, row2],
          });

          try {
            const confirmation = await response.awaitMessageComponent({
              filter: (i) => i.user.id === interaction.user.id,
              time: 30000,
              componentType: ComponentType.Button,
            });

            if (confirmation.customId === "cancel") {
              await confirmation.update({
                content: "Wybór anulowany",
                embeds: [],
                components: [],
              });
              return;
            }

            const selectedIndex = parseInt(confirmation.customId.split("_")[1]);
            track = tracks[selectedIndex];

            await confirmation.update({
              content: `Wybrano: ${track.info.title}`,
              embeds: [],
              components: [],
            });
          } catch (error) {
            await interaction.editReply({
              content: "Nie wybrano utworu w czasie 30 sekund.",
              embeds: [],
              components: [],
            });
            return;
          }
          break;
        }

        case LoadType.TRACK:
          track = result.data;
          break;
      }

      try {
        let player = client.shoukaku.players.get(interaction.guildId!);

        if (!player) {
          player = await client.shoukaku.joinVoiceChannel({
            guildId: interaction.guildId!,
            channelId: voiceChannel.id,
            shardId: interaction.guild!.shardId,
          });

          player.on("end", () => {
            playNext(client, interaction.guildId!, player);
          });

          player.on("start", async () => {
            const currentQueue = getQueue(interaction.guildId!);
            if (currentQueue.autoplay && currentQueue.currentTrack) {
              const similarTracks = await fetchSimilarTracks(
                client,
                currentQueue.currentTrack
              );
              if (similarTracks.length > 0) {
                // Dodaj do kolejki autoplay (zawsze na końcu)
                currentQueue.autoplayTracks.push(...similarTracks);
              }
            }
          });
        }

        // Dodajemy utwór do GŁÓWNEJ kolejki (przed autoplay), jeśli już coś jest odtwarzane
        if (musicQueue.currentTrack) {
          musicQueue.tracks.push(track); // Dodaj do głównej kolejki
          const embed = new EmbedBuilder()
            .setColor(0x00ff00)
            .setAuthor({ name: "Dodano do kolejki" })
            .setDescription(`[${track.info.title}](${track.info.uri})`)
            .addFields(
              {
                name: "Autor",
                value: track.info.author,
                inline: true,
              },
              {
                name: "Pozycja",
                value: `${musicQueue.tracks.length} (przed ${musicQueue.autoplayTracks.length} autoplay)`,
                inline: true,
              }
            )
            .setTimestamp();

          if (track.info.artworkUrl) {
            embed.setThumbnail(track.info.artworkUrl);
          }

          await interaction.editReply({ embeds: [embed] });
          return;
        }

        // Jeśli nic nie jest odtwarzane, rozpocznij odtwarzanie
        musicQueue.currentTrack = track;
        await player.playTrack({ track: { encoded: track.encoded } });
        await applyAudioFilters(player);

        await updatePlayerMessage(interaction, musicQueue);

        const collector = interaction.channel?.createMessageComponentCollector({
          filter: (i) =>
            Boolean(
              i.customId.match(
                /^(play|pause|stop|skip|shuffle|repeat|autoplay)$/
              )
            ),
          time: 1800000,
        });

        collector?.on("end", () => {
          if (interaction.replied || interaction.deferred) {
            interaction.editReply({ components: [] }).catch(() => {
              console.log(
                "Nie można zaktualizować wiadomości po zakończeniu kolektora"
              );
            });
          }
        });

        collector?.on("collect", async (i) => {
          const queue = getQueue(interaction.guildId!);
          const player = client.shoukaku.players.get(interaction.guildId!);
          if (!player || !queue.currentTrack) return;

          switch (i.customId) {
            case "play":
              queue.isPaused = false;
              await player.setPaused(false);
              break;
            case "pause":
              queue.isPaused = true;
              await player.setPaused(true);
              break;
            case "stop":
              await player.stopTrack();
              await client.shoukaku.leaveVoiceChannel(interaction.guildId!);
              break;
            case "skip":
              await player.stopTrack();
              break;
            case "shuffle":
              queue.isShuffled = !queue.isShuffled;
              if (queue.isShuffled) {
                // Pomieszaj tylko główną kolejkę, nie autoplay
                queue.tracks = queue.tracks.sort(() => Math.random() - 0.5);
              }
              break;
            case "repeat":
              queue.repeat = (queue.repeat + 1) % 3;
              break;
            case "autoplay":
              queue.autoplay = !queue.autoplay;
              manageAutoplayState(interaction.guildId!, queue.autoplay);
              if (queue.autoplay && queue.currentTrack) {
                const similarTracks = await fetchSimilarTracks(
                  client,
                  queue.currentTrack
                );
                queue.autoplayTracks.push(...similarTracks);
              } else {
                // Usuń utwory z autoplay
                queue.autoplayTracks = [];
              }
              await updatePlayerMessage(interaction, queue);
              await i.deferUpdate().catch(() => {});
              return;
          }

          try {
            await updatePlayerMessage(interaction, queue);
            await i.deferUpdate().catch(() => {
              console.log(
                "Interakcja wygasła, nie można zaktualizować wiadomości"
              );
            });
          } catch (error) {
            console.error("Błąd podczas aktualizacji wiadomości:", error);
          }
        });
      } catch (error) {
        console.error("Błąd podczas odtwarzania lub dołączania:", error);
        if (interaction.replied || interaction.deferred) {
          await interaction.editReply({
            content:
              "Wystąpił krytyczny błąd podczas próby odtworzenia utworu.",
          });
        }
      }
    }
  },
};

export default command;
