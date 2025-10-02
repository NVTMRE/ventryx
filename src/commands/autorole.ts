import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
  TextChannel,
  Role,
  ChatInputCommandInteraction,
  Guild,
  Message,
} from "discord.js";
import { Command } from "../types";
import { db } from "../database/connection";
import { autoRoles } from "../database/schema";
import { eq, and } from "drizzle-orm";

async function findMessageInGuild(
  guild: Guild,
  messageId: string
): Promise<Message | null> {
  const channels = guild.channels.cache.filter((c) => c.isTextBased());
  for (const channel of channels.values()) {
    try {
      return await (channel as TextChannel).messages.fetch(messageId);
    } catch {}
  }
  return null;
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("autorole")
    .setDescription("Zarządzaj systemem autoroli.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommandGroup((group) =>
      group
        .setName("panel")
        .setDescription("Zarządzaj panelami ról z reakcjami.")
        .addSubcommand((subcommand) =>
          subcommand
            .setName("create")
            .setDescription("Tworzy nowy, pusty panel ról.")
            .addChannelOption((option) =>
              option
                .setName("channel")
                .setDescription("Kanał, na którym ma powstać panel.")
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)
            )
            .addStringOption((option) =>
              option
                .setName("title")
                .setDescription("Tytuł panelu.")
                .setRequired(true)
            )
            .addStringOption((option) =>
              option
                .setName("description")
                .setDescription("Opis w panelu (użyj \\n dla nowej linii).")
                .setRequired(true)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("add")
            .setDescription("Dodaje rolę do istniejącego panelu.")
            .addStringOption((option) =>
              option
                .setName("message_id")
                .setDescription(
                  "ID wiadomości panelu, do którego chcesz dodać rolę."
                )
                .setRequired(true)
            )
            .addRoleOption((option) =>
              option
                .setName("role")
                .setDescription("Rola do dodania.")
                .setRequired(true)
            )
            .addStringOption((option) =>
              option
                .setName("emoji")
                .setDescription("Emoji powiązane z rolą.")
                .setRequired(true)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("delete")
            .setDescription("Usuwa rolę z istniejącego panelu.")
            .addStringOption((option) =>
              option
                .setName("message_id")
                .setDescription(
                  "ID wiadomości panelu, z którego chcesz usunąć rolę."
                )
                .setRequired(true)
            )
            .addRoleOption((option) =>
              option
                .setName("role")
                .setDescription("Rola do usunięcia.")
                .setRequired(true)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("list")
            .setDescription("Wyświetla listę aktywnych paneli ról.")
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("disable")
            .setDescription("Całkowicie usuwa panel ról i jego konfigurację.")
            .addStringOption((option) =>
              option
                .setName("message_id")
                .setDescription("ID wiadomości panelu do usunięcia.")
                .setRequired(true)
            )
        )
    )
    .addSubcommandGroup((group) =>
      group
        .setName("default")
        .setDescription("Zarządzaj domyślną rolą na serwerze.")
        .addSubcommand((subcommand) =>
          subcommand
            .setName("set")
            .setDescription(
              "Ustaw lub zmień domyślną rolę dla wszystkich użytkowników."
            )
            .addRoleOption((option) =>
              option
                .setName("role")
                .setDescription("Rola, która zostanie nadana wszystkim.")
                .setRequired(true)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("remove")
            .setDescription("Usuń domyślną rolę od wszystkich użytkowników.")
        )
    ),

  execute: async (interaction: ChatInputCommandInteraction): Promise<void> => {
    if (!interaction.guild) {
      await interaction.reply({
        content: "Ta komenda może być używana tylko na serwerze.",
        ephemeral: true,
      });
      return;
    }

    const group = interaction.options.getSubcommandGroup();
    const subcommand = interaction.options.getSubcommand();

    try {
      if (group === "panel") {
        if (subcommand === "create") await handlePanelCreate(interaction);
        else if (subcommand === "add") await handlePanelAdd(interaction);
        else if (subcommand === "delete") await handlePanelDelete(interaction);
        else if (subcommand === "list") await handlePanelList(interaction);
        else if (subcommand === "disable")
          await handlePanelDisable(interaction);
      } else if (group === "default") {
        if (subcommand === "set") await handleDefaultSet(interaction);
        else if (subcommand === "remove")
          await handleDefaultRemove(interaction);
      }
    } catch (error) {
      console.error(`Błąd w komendzie /autorole:`, error);
      const errorMessage =
        "❌ Wystąpił nieoczekiwany błąd podczas wykonywania tej komendy.";
      if (interaction.deferred || interaction.replied)
        await interaction.followUp({ content: errorMessage, ephemeral: true });
      else await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  },
};

async function handlePanelCreate(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const channel = interaction.options.getChannel(
    "channel",
    true
  ) as TextChannel;
  const title = interaction.options.getString("title", true);
  const description = interaction.options.getString("description", true);

  await interaction.deferReply({ ephemeral: true });

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(
      description.replace(/\\n/g, "\n") +
        "\n\n**Aktualne role:**\n_Brak ról. Użyj `/autorole panel add`_"
    )
    .setColor(0x5865f2);

  const message = await channel.send({ embeds: [embed] });

  await interaction.editReply({
    content: `✅ Pomyślnie utworzono panel ról. ID wiadomości to: \`${message.id}\`\nUżyj go w kolejnych komendach, aby dodać role.`,
  });
}

async function handlePanelAdd(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const messageId = interaction.options.getString("message_id", true);
  const role = interaction.options.getRole("role", true) as Role;
  const emojiInput = interaction.options.getString("emoji", true);
  const guild = interaction.guild!;

  await interaction.deferReply({ ephemeral: true });

  const customEmojiMatch = emojiInput.match(/<a?:\w+:(\d+)>/);
  // Ta nowa, bardziej liberalna regex poprawnie rozpoznaje emoji takie jak 🛡️
  const isStandardEmoji = /\p{Extended_Pictographic}/u.test(emojiInput);

  if (!customEmojiMatch && !isStandardEmoji) {
    await interaction.editReply(
      "❌ Wprowadzono niepoprawne emoji. Użyj standardowego emoji Discorda (np. 👍) lub pełnego formatu niestandardowego emoji (np. `<:nazwa:ID>`)."
    );
    return;
  }

  const emojiForDb = customEmojiMatch ? customEmojiMatch[1] : emojiInput;
  const emojiForReaction = customEmojiMatch ? customEmojiMatch[1] : emojiInput;

  const message = await findMessageInGuild(guild, messageId);
  if (!message) {
    await interaction.editReply(
      "❌ Nie znaleziono wiadomości panelu o podanym ID na tym serwerze."
    );
    return;
  }

  const botMember = await guild.members.fetch(interaction.client.user.id);
  if (role.position >= botMember.roles.highest.position) {
    await interaction.editReply(
      `❌ Błąd: Rola **${role.name}** jest wyżej niż moja. Nie mogę nią zarządzać.`
    );
    return;
  }

  const existingEmoji = await db.query.autoRoles.findFirst({
    where: and(
      eq(autoRoles.messageId, messageId),
      eq(autoRoles.guildId, guild.id),
      eq(autoRoles.emoji, emojiForDb)
    ),
  });
  if (existingEmoji) {
    await interaction.editReply(`❌ To emoji jest już używane w tym panelu.`);
    return;
  }

  const oldEmbed = message.embeds[0];
  let newDescription = (oldEmbed.description || "").replace(
    "\n_Brak ról. Użyj `/autorole panel add`_",
    ""
  );
  newDescription += `\n${emojiInput} - <@&${role.id}>`;
  const newEmbed = EmbedBuilder.from(oldEmbed).setDescription(newDescription);
  await message.edit({ embeds: [newEmbed] });

  await message
    .react(emojiForReaction)
    .catch((e) => console.error("Nie udało się dodać reakcji:", e));

  await db.insert(autoRoles).values({
    guildId: guild.id,
    messageId: message.id,
    roleId: role.id,
    emoji: emojiForDb,
    isDefault: false,
  });

  await interaction.editReply(
    `✅ Pomyślnie dodano rolę ${role} z emoji ${emojiInput} do panelu.`
  );
}

async function handlePanelDelete(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const messageId = interaction.options.getString("message_id", true);
  const role = interaction.options.getRole("role", true) as Role;
  const guild = interaction.guild!;

  await interaction.deferReply({ ephemeral: true });

  const config = await db.query.autoRoles.findFirst({
    where: and(
      eq(autoRoles.messageId, messageId),
      eq(autoRoles.roleId, role.id)
    ),
  });

  if (!config) {
    await interaction.editReply(
      "❌ Ta rola nie jest przypisana do tego panelu."
    );
    return;
  }

  const message = await findMessageInGuild(guild, messageId);
  if (message) {
    const oldEmbed = message.embeds[0];
    const lines = (oldEmbed.description || "").split("\n");
    const newLines = lines.filter((line) => !line.includes(role.id));
    let updatedDescription = newLines.join("\n").trim();
    if (!newLines.some((line) => line.includes("<@&"))) {
      updatedDescription += "\n_Brak ról. Użyj `/autorole panel add`_";
    }

    const newEmbed =
      EmbedBuilder.from(oldEmbed).setDescription(updatedDescription);
    await message.edit({ embeds: [newEmbed] });

    const reaction = message.reactions.cache.get(config.emoji);
    if (reaction && reaction.users.cache.has(interaction.client.user.id)) {
      await reaction.users.remove(interaction.client.user.id);
    }
  }

  await db
    .delete(autoRoles)
    .where(
      and(eq(autoRoles.messageId, messageId), eq(autoRoles.roleId, role.id))
    );

  await interaction.editReply(`✅ Pomyślnie usunięto rolę ${role} z panelu.`);
}

async function handlePanelList(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const guild = interaction.guild!;

  const panelConfigs = await db.query.autoRoles.findMany({
    where: and(eq(autoRoles.guildId, guild.id), eq(autoRoles.isDefault, false)),
    orderBy: autoRoles.messageId,
  });

  if (panelConfigs.length === 0) {
    await interaction.editReply(
      "ℹ️ Na tym serwerze nie ma aktywnych paneli ról."
    );
    return;
  }

  const panelsMap = new Map<
    string,
    {
      title: string;
      url: string;
      channelId: string | null;
      roles: { roleId: string; emoji: string }[];
    }
  >();

  for (const config of panelConfigs) {
    if (!panelsMap.has(config.messageId)) {
      const message = await findMessageInGuild(guild, config.messageId);
      panelsMap.set(config.messageId, {
        title: message?.embeds[0]?.title || "Brak tytułu",
        url: message?.url || "#",
        channelId: message?.channel.id || null,
        roles: [],
      });
    }
    panelsMap
      .get(config.messageId)!
      .roles.push({ roleId: config.roleId, emoji: config.emoji });
  }

  const embed = new EmbedBuilder()
    .setTitle("Lista paneli ról")
    .setColor(0x5865f2)
    .setDescription(
      "Poniżej znajdziesz listę wszystkich skonfigurowanych paneli ról na tym serwerze."
    );

  for (const [messageId, panelData] of panelsMap.entries()) {
    const rolesContent = panelData.roles
      .map((r) => {
        const customEmoji = guild.emojis.cache.get(r.emoji);
        const displayEmoji = customEmoji ? customEmoji.toString() : r.emoji;
        return `${displayEmoji} - <@&${r.roleId}>`;
      })
      .join("\n");

    let fieldTitle = `Panel "${panelData.title}"`;
    let fieldValue = `**ID Wiadomości:** \`${messageId}\`\n`;
    if (panelData.channelId) {
      fieldValue += `**Kanał:** <#${panelData.channelId}> | **[Link](${panelData.url})**\n`;
    } else {
      fieldValue += `**Status:** ⚠️ Wiadomość usunięta lub niedostępna.\n`;
    }
    fieldValue += `**Role:**\n${rolesContent || "_Brak_"}`;

    embed.addFields({ name: fieldTitle, value: fieldValue, inline: false });
  }

  await interaction.editReply({ embeds: [embed] });
}

async function handlePanelDisable(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const messageId = interaction.options.getString("message_id", true);
  await interaction.deferReply({ ephemeral: true });

  const message = await findMessageInGuild(interaction.guild!, messageId);
  if (message) {
    await message
      .delete()
      .catch((e) =>
        console.error("Nie udało się usunąć wiadomości panelu:", e)
      );
  }

  await db
    .delete(autoRoles)
    .where(
      and(
        eq(autoRoles.guildId, interaction.guildId!),
        eq(autoRoles.messageId, messageId)
      )
    );

  await interaction.editReply(
    "✅ Pomyślnie usunięto panel i jego konfigurację z bazy danych."
  );
}

async function handleDefaultSet(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const newRole = interaction.options.getRole("role", true) as Role;
  const guild = interaction.guild!;
  const botMember = await guild.members.fetch(interaction.client.user.id);

  if (newRole.id === guild.id) {
    await interaction.reply({
      content: "❌ Rola @everyone nie może być ustawiona jako rola domyślna.",
      ephemeral: true,
    });
    return;
  }

  if (newRole.position >= botMember.roles.highest.position) {
    await interaction.reply({
      content: `❌ Błąd: Rola **${newRole.name}** jest wyżej niż moja. Nie mogę nią zarządzać.`,
      ephemeral: true,
    });
    return;
  }

  await interaction.reply({
    content: `🔄 Rozpoczynam proces... To może potrwać dłuższą chwilę.`,
    ephemeral: true,
  });

  const oldDefaultConfig = await db.query.autoRoles.findFirst({
    where: and(eq(autoRoles.guildId, guild.id), eq(autoRoles.isDefault, true)),
  });

  const allMembers = await guild.members.fetch();

  if (oldDefaultConfig) {
    await interaction.followUp({
      content: `1/3: Odbieranie poprzedniej roli domyślnej...`,
      ephemeral: true,
    });
    try {
      const oldRole = await guild.roles.fetch(oldDefaultConfig.roleId);
      if (oldRole) {
        const removePromises = allMembers.map((member) =>
          member.roles.remove(oldRole).catch(() => {})
        );
        await Promise.allSettled(removePromises);
      }
    } catch {
      /* Ignoruj błąd */
    }
    await db
      .delete(autoRoles)
      .where(
        and(eq(autoRoles.guildId, guild.id), eq(autoRoles.isDefault, true))
      );
  }

  await interaction.followUp({
    content: `2/3: Nadawanie nowej roli **${newRole.name}** wszystkim użytkownikom...`,
    ephemeral: true,
  });
  const addPromises = allMembers.map((member) =>
    member.roles.add(newRole).catch(() => {})
  );
  await Promise.allSettled(addPromises);

  await interaction.followUp({
    content: "3/3: Zapisywanie konfiguracji...",
    ephemeral: true,
  });
  await db.insert(autoRoles).values({
    guildId: guild.id,
    messageId: "default",
    roleId: newRole.id,
    emoji: "default",
    isDefault: true,
  });

  await interaction.followUp({
    content: `✅ Zakończono! Rola ${newRole} jest teraz domyślną rolą na serwerze.`,
    ephemeral: true,
  });
}

async function handleDefaultRemove(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const guild = interaction.guild!;
  await interaction.reply({
    content:
      "🔄 Rozpoczynam odbieranie roli domyślnej... To może potrwać chwilę.",
    ephemeral: true,
  });

  const defaultConfig = await db.query.autoRoles.findFirst({
    where: and(eq(autoRoles.guildId, guild.id), eq(autoRoles.isDefault, true)),
  });

  if (!defaultConfig) {
    await interaction.editReply(
      "ℹ️ Na tym serwerze nie jest ustawiona żadna rola domyślna."
    );
    return;
  }

  await interaction.followUp({
    content: "1/2: Odbieranie roli od wszystkich użytkowników...",
    ephemeral: true,
  });
  try {
    const roleToRemove = await guild.roles.fetch(defaultConfig.roleId);
    if (roleToRemove) {
      const allMembers = await guild.members.fetch();
      const removePromises = allMembers.map((member) =>
        member.roles.remove(roleToRemove).catch(() => {})
      );
      await Promise.allSettled(removePromises);
    }
  } catch {
    /* Ignoruj błąd */
  }

  await interaction.followUp({
    content: "2/2: Usuwanie konfiguracji...",
    ephemeral: true,
  });
  await db
    .delete(autoRoles)
    .where(and(eq(autoRoles.guildId, guild.id), eq(autoRoles.isDefault, true)));

  await interaction.followUp({
    content: "✅ Pomyślnie odebrano rolę domyślną i usunięto jej konfigurację.",
    ephemeral: true,
  });
}

export default command;
