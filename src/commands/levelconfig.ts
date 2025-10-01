import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  GuildMember,
  ChannelType,
} from "discord.js";
import { Command } from "../types";
import { db } from "../database/connection";
import { levelConfig } from "../database/schema";
import { eq } from "drizzle-orm";

// Funkcja do konwersji koloru z env na format Discord.js
function getEmbedColor(): number {
  const envColor = process.env.EMBEDED_COLOR || "6f00ff";
  // Usuń # jeśli istnieje i weź tylko pierwsze 6 znaków (RGB bez alpha)
  const cleanColor = envColor.replace("#", "").substring(0, 6);
  return parseInt(cleanColor, 16);
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("levelconfig")
    .setDescription("Konfiguracja systemu poziomów (tylko admin)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub.setName("view").setDescription("Wyświetl aktualną konfigurację")
    )
    .addSubcommand((sub) =>
      sub.setName("enable").setDescription("Włącz system poziomów")
    )
    .addSubcommand((sub) =>
      sub.setName("disable").setDescription("Wyłącz system poziomów")
    )
    .addSubcommand((sub) =>
      sub
        .setName("setmessagexp")
        .setDescription("Ustaw XP za wiadomość")
        .addIntegerOption((option) =>
          option
            .setName("xp")
            .setDescription("Ilość XP (domyślnie 15)")
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(100)
        )
        .addIntegerOption((option) =>
          option
            .setName("variance")
            .setDescription("Losowy zakres +/- (domyślnie 10)")
            .setRequired(false)
            .setMinValue(0)
            .setMaxValue(50)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("setvoicexp")
        .setDescription("Ustaw XP za minutę na VC")
        .addIntegerOption((option) =>
          option
            .setName("xp")
            .setDescription("Ilość XP za minutę (domyślnie 5)")
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(50)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("setcooldown")
        .setDescription("Ustaw cooldown na XP z wiadomości")
        .addIntegerOption((option) =>
          option
            .setName("seconds")
            .setDescription("Cooldown w sekundach (domyślnie 60)")
            .setRequired(true)
            .setMinValue(10)
            .setMaxValue(300)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("ignorechannel")
        .setDescription("Dodaj/usuń kanał z listy ignorowanych")
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("Kanał do zignorowania")
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("setlevelupchannel")
        .setDescription("Ustaw kanał dla powiadomień o poziomach")
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("Kanał (puste = aktualny kanał)")
            .setRequired(false)
            .addChannelTypes(ChannelType.GuildText)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("setlevelupmessage")
        .setDescription("Ustaw wiadomość o awansie poziomu")
        .addStringOption((option) =>
          option
            .setName("message")
            .setDescription("Wiadomość ({user} = wzmianka, {level} = poziom)")
            .setRequired(true)
        )
    ),

  execute: async (interaction: ChatInputCommandInteraction) => {
    const member = interaction.member as GuildMember;

    if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({
        content: "❌ Nie masz uprawnień do użycia tej komendy!",
        ephemeral: true,
      });
      return;
    }

    if (!interaction.guild) {
      await interaction.reply({
        content: "Ta komenda działa tylko na serwerze!",
        ephemeral: true,
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case "view":
        await handleView(interaction);
        break;
      case "enable":
        await handleToggle(interaction, true);
        break;
      case "disable":
        await handleToggle(interaction, false);
        break;
      case "setmessagexp":
        await handleSetMessageXP(interaction);
        break;
      case "setvoicexp":
        await handleSetVoiceXP(interaction);
        break;
      case "setcooldown":
        await handleSetCooldown(interaction);
        break;
      case "ignorechannel":
        await handleIgnoreChannel(interaction);
        break;
      case "setlevelupchannel":
        await handleSetLevelUpChannel(interaction);
        break;
      case "setlevelupmessage":
        await handleSetLevelUpMessage(interaction);
        break;
    }
  },
};

async function getOrCreateConfig(guildId: string) {
  const configs = await db
    .select()
    .from(levelConfig)
    .where(eq(levelConfig.guildId, guildId))
    .limit(1);

  if (configs[0]) {
    return configs[0];
  }

  const newConfig = await db
    .insert(levelConfig)
    .values({ guildId })
    .returning();

  return newConfig[0];
}

async function handleView(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.channel) {
    await interaction.editReply({ content: "❌ Nie znaleziono kanału!" });
    return;
  }

  const config = await getOrCreateConfig(interaction.guild!.id);

  const embed = new EmbedBuilder()
    .setColor(getEmbedColor())
    .setTitle("⚙️ Konfiguracja Systemu Poziomów")
    .addFields([
      {
        name: "Status",
        value: config.enabled ? "✅ Włączony" : "❌ Wyłączony",
        inline: true,
      },
      {
        name: "XP za wiadomość",
        value: `${config.xpPerMessage} ± ${config.xpPerMessageVariance}`,
        inline: true,
      },
      {
        name: "XP za minutę VC",
        value: `${config.xpPerVoiceMinute}`,
        inline: true,
      },
      {
        name: "Cooldown",
        value: `${config.messageCooldown}s`,
        inline: true,
      },
      {
        name: "Ignorowane kanały",
        value:
          config.ignoreChannels && config.ignoreChannels.length > 0
            ? config.ignoreChannels.map((id) => `<#${id}>`).join(", ")
            : "Brak",
        inline: false,
      },
      {
        name: "Kanał powiadomień",
        value: config.levelUpChannel
          ? `<#${config.levelUpChannel}>`
          : "Aktualny kanał",
        inline: true,
      },
      {
        name: "Wiadomość o awansie",
        value: config.levelUpMessage || "Domyślna",
        inline: false,
      },
    ])
    .setTimestamp()
    .setFooter({
      text: "Ventryx Level System",
      iconURL: interaction.client.user?.displayAvatarURL(),
    });

  await interaction.editReply({ embeds: [embed] });
}

async function handleToggle(
  interaction: ChatInputCommandInteraction,
  enabled: boolean
) {
  await interaction.deferReply({ ephemeral: true });

  const config = await getOrCreateConfig(interaction.guild!.id);

  await db
    .update(levelConfig)
    .set({ enabled, updatedAt: new Date() })
    .where(eq(levelConfig.guildId, interaction.guild!.id));

  const embed = new EmbedBuilder()
    .setColor(getEmbedColor())
    .setTitle(enabled ? "✅ System włączony" : "❌ System wyłączony")
    .setDescription(
      enabled
        ? "System poziomów został włączony na tym serwerze!"
        : "System poziomów został wyłączony na tym serwerze."
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleSetMessageXP(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const xp = interaction.options.getInteger("xp", true);
  const variance = interaction.options.getInteger("variance") || 10;

  await db
    .update(levelConfig)
    .set({
      xpPerMessage: xp,
      xpPerMessageVariance: variance,
      updatedAt: new Date(),
    })
    .where(eq(levelConfig.guildId, interaction.guild!.id));

  const embed = new EmbedBuilder()
    .setColor(getEmbedColor())
    .setTitle("✅ XP za wiadomość zaktualizowane")
    .setDescription(`Nowa wartość: **${xp} ± ${variance} XP**`)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleSetVoiceXP(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const xp = interaction.options.getInteger("xp", true);

  await db
    .update(levelConfig)
    .set({
      xpPerVoiceMinute: xp,
      updatedAt: new Date(),
    })
    .where(eq(levelConfig.guildId, interaction.guild!.id));

  const embed = new EmbedBuilder()
    .setColor(getEmbedColor())
    .setTitle("✅ XP za VC zaktualizowane")
    .setDescription(`Nowa wartość: **${xp} XP/minutę**`)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleSetCooldown(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const seconds = interaction.options.getInteger("seconds", true);

  await db
    .update(levelConfig)
    .set({
      messageCooldown: seconds,
      updatedAt: new Date(),
    })
    .where(eq(levelConfig.guildId, interaction.guild!.id));

  const embed = new EmbedBuilder()
    .setColor(getEmbedColor())
    .setTitle("✅ Cooldown zaktualizowany")
    .setDescription(`Nowy cooldown: **${seconds} sekund**`)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleIgnoreChannel(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const channel = interaction.options.getChannel("channel", true);

  const config = await getOrCreateConfig(interaction.guild!.id);
  const ignoreChannels = config.ignoreChannels || [];

  let newIgnoreChannels: string[];
  let action: string;

  if (ignoreChannels.includes(channel.id)) {
    // Usuń z listy
    newIgnoreChannels = ignoreChannels.filter((id) => id !== channel.id);
    action = "usunięto z";
  } else {
    // Dodaj do listy
    newIgnoreChannels = [...ignoreChannels, channel.id];
    action = "dodano do";
  }

  await db
    .update(levelConfig)
    .set({
      ignoreChannels: newIgnoreChannels,
      updatedAt: new Date(),
    })
    .where(eq(levelConfig.guildId, interaction.guild!.id));

  const embed = new EmbedBuilder()
    .setColor(getEmbedColor())
    .setTitle("✅ Lista kanałów zaktualizowana")
    .setDescription(`Kanał ${channel.name} ${action} listy ignorowanych`)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleSetLevelUpChannel(
  interaction: ChatInputCommandInteraction
) {
  await interaction.deferReply({ ephemeral: true });

  const channel = interaction.options.getChannel("channel");

  await db
    .update(levelConfig)
    .set({
      levelUpChannel: channel?.id || null,
      updatedAt: new Date(),
    })
    .where(eq(levelConfig.guildId, interaction.guild!.id));

  const embed = new EmbedBuilder()
    .setColor(getEmbedColor())
    .setTitle("✅ Kanał powiadomień zaktualizowany")
    .setDescription(
      channel
        ? `Powiadomienia będą wysyłane na ${channel.name}`
        : "Powiadomienia będą wysyłane na aktualnym kanale"
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleSetLevelUpMessage(
  interaction: ChatInputCommandInteraction
) {
  await interaction.deferReply({ ephemeral: true });

  const message = interaction.options.getString("message", true);

  await db
    .update(levelConfig)
    .set({
      levelUpMessage: message,
      updatedAt: new Date(),
    })
    .where(eq(levelConfig.guildId, interaction.guild!.id));

  const embed = new EmbedBuilder()
    .setColor(getEmbedColor())
    .setTitle("✅ Wiadomość zaktualizowana")
    .setDescription(`Nowa wiadomość:\n${message}`)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

export default command;
