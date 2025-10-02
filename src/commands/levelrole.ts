import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  GuildMember,
  Role,
} from "discord.js";
import { Command } from "../types";
import { db } from "../database/connection";
import { levelRoles } from "../database/schema";
import { eq, and } from "drizzle-orm";

function getEmbedColor(): number {
  const envColor = process.env.EMBEDED_COLOR || "6f00ff";
  const cleanColor = envColor.replace("#", "").substring(0, 6);
  return parseInt(cleanColor, 16);
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("levelrole")
    .setDescription("Zarządzaj rolami przydzielanymi za poziomy (tylko admin)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Dodaj rolę za zakres poziomów")
        .addRoleOption((option) =>
          option
            .setName("role")
            .setDescription("Rola do przydzielenia")
            .setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName("min_level")
            .setDescription("Minimalny poziom (włącznie)")
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(999)
        )
        .addIntegerOption((option) =>
          option
            .setName("max_level")
            .setDescription("Maksymalny poziom (włącznie)")
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(999)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Usuń rolę z systemu poziomów")
        .addRoleOption((option) =>
          option
            .setName("role")
            .setDescription("Rola do usunięcia")
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("Wyświetl listę ról za poziomy")
    )
    .addSubcommand((sub) =>
      sub
        .setName("sync")
        .setDescription("Synchronizuj role wszystkich użytkowników")
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
      case "add":
        await handleAdd(interaction);
        break;
      case "remove":
        await handleRemove(interaction);
        break;
      case "list":
        await handleList(interaction);
        break;
      case "sync":
        await handleSync(interaction);
        break;
    }
  },
};

async function handleAdd(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const role = interaction.options.getRole("role", true) as Role;
  const minLevel = interaction.options.getInteger("min_level", true);
  const maxLevel = interaction.options.getInteger("max_level", true);
  const guildId = interaction.guild!.id;

  if (minLevel > maxLevel) {
    await interaction.editReply({
      content: "❌ Minimalny poziom nie może być większy niż maksymalny!",
    });
    return;
  }

  const botMember = await interaction.guild!.members.fetch(
    interaction.client.user.id
  );
  if (role.position >= botMember.roles.highest.position) {
    await interaction.editReply({
      content: `❌ Rola **${role.name}** jest wyżej niż moja. Nie mogę nią zarządzać.`,
    });
    return;
  }

  const existing = await db
    .select()
    .from(levelRoles)
    .where(and(eq(levelRoles.guildId, guildId), eq(levelRoles.roleId, role.id)))
    .limit(1);

  if (existing[0]) {
    await interaction.editReply({
      content: `❌ Ta rola jest już przypisana do systemu poziomów!\nAktualny zakres: poziomy ${existing[0].minLevel}-${existing[0].maxLevel}`,
    });
    return;
  }

  const allRoles = await db
    .select()
    .from(levelRoles)
    .where(eq(levelRoles.guildId, guildId));

  const overlapping = allRoles.find(
    (r) =>
      (minLevel >= r.minLevel && minLevel <= r.maxLevel) ||
      (maxLevel >= r.minLevel && maxLevel <= r.maxLevel) ||
      (minLevel <= r.minLevel && maxLevel >= r.maxLevel)
  );

  if (overlapping) {
    const overlappingRole = await interaction.guild!.roles.fetch(
      overlapping.roleId
    );
    await interaction.editReply({
      content: `⚠️ Uwaga! Zakresy poziomów nakładają się z rolą ${overlappingRole?.name} (poziomy ${overlapping.minLevel}-${overlapping.maxLevel}).\n\nMożesz kontynuować, ale użytkownicy w nakładających się poziomach mogą otrzymać obie role.`,
    });
  }

  // BEZ nanoid() - Drizzle wygeneruje ID automatycznie
  await db.insert(levelRoles).values({
    guildId,
    roleId: role.id,
    minLevel,
    maxLevel,
  });

  const embed = new EmbedBuilder()
    .setColor(getEmbedColor())
    .setTitle("✅ Rola za poziomy dodana")
    .setDescription(
      `Rola ${role} będzie przydzielana użytkownikom na poziomach **${minLevel}-${maxLevel}**`
    )
    .addFields({
      name: "ℹ️ Informacja",
      value:
        "Użyj `/levelrole sync` aby natychmiast przydzielić role wszystkim użytkownikom, lub poczekaj aż użytkownicy awansują poziom.",
    })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleRemove(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const role = interaction.options.getRole("role", true) as Role;
  const guildId = interaction.guild!.id;

  const existing = await db
    .select()
    .from(levelRoles)
    .where(and(eq(levelRoles.guildId, guildId), eq(levelRoles.roleId, role.id)))
    .limit(1);

  if (!existing[0]) {
    await interaction.editReply({
      content: "❌ Ta rola nie jest przypisana do systemu poziomów!",
    });
    return;
  }

  await db
    .delete(levelRoles)
    .where(
      and(eq(levelRoles.guildId, guildId), eq(levelRoles.roleId, role.id))
    );

  const embed = new EmbedBuilder()
    .setColor(getEmbedColor())
    .setTitle("✅ Rola usunięta")
    .setDescription(
      `Rola ${role} została usunięta z systemu poziomów.\n\n⚠️ **Uwaga:** Role nie zostały automatycznie odebrane użytkownikom. Możesz ręcznie odebrać je lub użyć \`/levelrole sync\`.`
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleList(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const guildId = interaction.guild!.id;
  const roles = await db
    .select()
    .from(levelRoles)
    .where(eq(levelRoles.guildId, guildId));

  if (roles.length === 0) {
    await interaction.editReply({
      content:
        "ℹ️ Na tym serwerze nie ma skonfigurowanych ról za poziomy.\nUżyj `/levelrole add` aby dodać pierwszą rolę!",
    });
    return;
  }

  const sortedRoles = roles.sort((a, b) => a.minLevel - b.minLevel);

  const embed = new EmbedBuilder()
    .setColor(getEmbedColor())
    .setTitle("📋 Role za poziomy")
    .setDescription(
      `Skonfigurowane role dla poziomów na serwerze ${interaction.guild!.name}`
    )
    .setTimestamp();

  for (const roleConfig of sortedRoles) {
    const role = await interaction.guild!.roles.fetch(roleConfig.roleId);
    if (role) {
      embed.addFields({
        name: `${role.name}`,
        value: `🎯 **Poziomy:** ${roleConfig.minLevel}-${
          roleConfig.maxLevel
        }\n📅 **Dodano:** ${
          roleConfig.createdAt?.toLocaleDateString("pl-PL") || "Nieznana data"
        }`,
        inline: true,
      });
    } else {
      embed.addFields({
        name: "⚠️ Usunięta rola",
        value: `ID: \`${roleConfig.roleId}\`\nPoziomy: ${roleConfig.minLevel}-${roleConfig.maxLevel}`,
        inline: true,
      });
    }
  }

  await interaction.editReply({ embeds: [embed] });
}

async function handleSync(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const guildId = interaction.guild!.id;
  const guild = interaction.guild!;

  await interaction.editReply({
    content: "🔄 Rozpoczynam synchronizację ról... To może potrwać chwilę.",
  });

  const roleConfigs = await db
    .select()
    .from(levelRoles)
    .where(eq(levelRoles.guildId, guildId));

  if (roleConfigs.length === 0) {
    await interaction.editReply({
      content: "ℹ️ Brak skonfigurowanych ról do synchronizacji.",
    });
    return;
  }

  const { userLevels } = await import("../database/schema");
  const allUserLevels = await db
    .select()
    .from(userLevels)
    .where(eq(userLevels.guildId, guildId));

  let syncedUsers = 0;
  let errors = 0;

  for (const userLevel of allUserLevels) {
    try {
      const member = await guild.members.fetch(userLevel.userId);
      if (!member) continue;

      for (const roleConfig of roleConfigs) {
        const role = guild.roles.cache.get(roleConfig.roleId);
        if (role && member.roles.cache.has(role.id)) {
          await member.roles.remove(role).catch(() => {});
        }
      }

      for (const roleConfig of roleConfigs) {
        if (
          userLevel.level >= roleConfig.minLevel &&
          userLevel.level <= roleConfig.maxLevel
        ) {
          const role = guild.roles.cache.get(roleConfig.roleId);
          if (role && !member.roles.cache.has(role.id)) {
            await member.roles.add(role).catch(() => {
              errors++;
            });
          }
        }
      }

      syncedUsers++;
    } catch (error) {
      errors++;
      console.error(`Error syncing roles for user ${userLevel.userId}:`, error);
    }
  }

  const embed = new EmbedBuilder()
    .setColor(getEmbedColor())
    .setTitle("✅ Synchronizacja zakończona")
    .addFields(
      {
        name: "Zsynchronizowani użytkownicy",
        value: `${syncedUsers}`,
        inline: true,
      },
      {
        name: "Błędy",
        value: `${errors}`,
        inline: true,
      }
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

export default command;
