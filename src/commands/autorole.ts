import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  Role,
  SlashCommandBuilder,
  TextChannel,
} from 'discord.js';
import { db } from '../lib/db';
import { autoroles, autoroleReactions } from '../lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { t } from '../lib/i18n';
import {embedColor} from "../config/embed-color";

export const data = new SlashCommandBuilder()
  .setName('autorole')
  .setDescription(t('commands.autorole.description'))
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(subcommand =>
    subcommand
      .setName('set')
      .setDescription(t('commands.autorole.set.description'))
      .addRoleOption(option =>
        option
          .setName('role')
          .setDescription(t('commands.autorole.set.option_role'))
          .setRequired(true),
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('show')
      .setDescription(t('commands.autorole.show.description')),
  )
  .addSubcommandGroup(group =>
    group
      .setName('panel')
      .setDescription(t('commands.autorole.panel.description'))
      .addSubcommand(sub =>
        sub
          .setName('create')
          .setDescription(t('commands.autorole.panel.create.description'))
          .addRoleOption(opt =>
            opt.setName('role').setDescription(t('commands.autorole.panel.create.option_role')).setRequired(true)
          )
          .addStringOption(opt =>
            opt.setName('emoji').setDescription(t('commands.autorole.panel.create.option_emoji')).setRequired(true)
          )
          .addStringOption(opt =>
            opt
              .setName('panel_id')
              .setDescription(t('commands.autorole.panel.create.option_panel_id'))
              .setRequired(true)
          )
          .addStringOption(opt =>
            opt.setName('description').setDescription(t('commands.autorole.panel.create.option_description')).setRequired(false)
          )
      )
      .addSubcommand(sub =>
        sub
          .setName('list')
          .setDescription(t('commands.autorole.panel.list.description'))
          .addStringOption(opt =>
            opt
              .setName('panel_id')
              .setDescription(t('commands.autorole.panel.list.option_panel_id'))
              .setRequired(false)
          )
      )
      .addSubcommand(sub =>
        sub
          .setName('remove')
          .setDescription(t('commands.autorole.panel.remove.description'))
          .addRoleOption(opt =>
            opt.setName('role').setDescription(t('commands.autorole.panel.remove.option_role')).setRequired(true)
          )
          .addStringOption(opt =>
            opt
              .setName('panel_id')
              .setDescription(t('commands.autorole.panel.remove.option_panel_id'))
              .setRequired(true)
          )
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId || !interaction.guild) {
    return interaction.reply({
      content: t('errors.missing_guild'),
      flags: MessageFlags.Ephemeral,
    });
  }

  const subcommand = interaction.options.getSubcommand();
  const subcommandGroup = interaction.options.getSubcommandGroup(false);

  // /autorole set - pojedyncza rola automatyczna (nie panele)
  if (subcommand === 'set') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const role = interaction.options.getRole('role', true) as Role;

      // Check if an autorole is already set for this guild
      const existing = await db.query.autoroles.findFirst({
        where: eq(autoroles.guildId, interaction.guildId),
      });

      const newRoleId = role.id;

      if (existing) {
        // Remove old autorole from all members who have it
        const oldRole = await interaction.guild.roles.fetch(existing.roleId).catch(() => null);

        if (oldRole) {
          const members = await interaction.guild.members.fetch();
          for (const member of members.values()) {
            if (member.roles.cache.has(oldRole.id)) {
              await member.roles.remove(oldRole).catch(err =>
                console.warn(`[AutoRole] Couldn't remove old role from ${member.user.tag}:`, err.message)
              );
            }
          }
        }

        // Update DB with a new role
        await db.update(autoroles)
          .set({ roleId: newRoleId })
          .where(eq(autoroles.guildId, interaction.guildId));
      } else {
        // Insert new autorole
        await db.insert(autoroles).values({
          guildId: interaction.guildId,
          roleId: newRoleId,
        });
      }

      // Assign the new autorole to all non-bot members
      const members = await interaction.guild.members.fetch();
      for (const member of members.values()) {
        if (!member.user.bot) {
          await member.roles.add(role).catch(err =>
            console.warn(`[AutoRole] Couldn't assign new role to ${member.user.tag}:`, err.message)
          );
        }
      }

      await interaction.editReply({
        content: t('commands.autorole.set.success', { roleId: newRoleId }),
      });

    } catch (error) {
      console.error(`[Autorole Set] Error:`, error);
      await interaction.editReply({
        content: t('commands.autorole.set.error', {
          message: (error as Error).message,
        }),
      });
    }

    // /autorole show
  } else if (subcommand === 'show') {
    try {
      const result = await db.query.autoroles.findFirst({
        where: eq(autoroles.guildId, interaction.guildId),
      });

      if (!result) {
        await interaction.reply({
          content: t('commands.autorole.show.notSet'),
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await interaction.reply({
        content: t('commands.autorole.show.success', { roleId: result.roleId }),
        flags: MessageFlags.Ephemeral,
      });

    } catch (error) {
      console.error('Error executing autorole-show command:', error);
      await interaction.reply({
        content: t('errors.unexpected'),
        flags: MessageFlags.Ephemeral,
      });
    }

    // /autorole panel create - enhanced to support multiple roles in one panel message
  } else if (subcommandGroup === 'panel' && subcommand === 'create') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const role = interaction.options.getRole('role', true) as Role;
      const emoji = interaction.options.getString('emoji', true);
      const desc = interaction.options.getString('description') ?? role.name;
      const panelId = interaction.options.getString('panel_id') ?? 'default'; // domyślny panelId = 'default'

      const channel = interaction.channel;

      if (!channel || !(channel instanceof TextChannel)) {
        return interaction.editReply({
          content: t('errors.invalid_channel'),
        });
      }

      // Sprawdź czy jest już panel o danym panelId w tym guildzie (sprawdzamy czy jest messageId dla panelId)
      const existingReactionsForPanel = await db.query.autoroleReactions.findMany({
        where: and(
          eq(autoroleReactions.guildId, interaction.guildId),
          eq(autoroleReactions.panelId, panelId)
        ),
      });

      if (existingReactionsForPanel.length > 0) {
        // Panel istnieje, pobierz wiadomość panelu
        const messageId = existingReactionsForPanel[0].messageId;

        const message = await channel.messages.fetch(messageId).catch(() => null);

        if (!message) {
          // Wiadomość została usunięta, wyczyść reakcje i stwórz panel od nowa
          await db.delete(autoroleReactions).where(
            and(
              eq(autoroleReactions.guildId, interaction.guildId),
              eq(autoroleReactions.panelId, panelId),
            )
          );
          throw new Error('Panel message missing, creating a new one.');
        }

        // Sprawdź czy rola już istnieje w panelu
        const roleExists = existingReactionsForPanel.some(r => r.roleId === role.id);
        if (roleExists) {
          return interaction.editReply({
            content: t('commands.autorole.panel.already_exists'),
          });
        }

        // Dodaj nową reakcję w DB
        await db.insert(autoroleReactions).values({
          guildId: interaction.guildId,
          messageId,
          emoji,
          roleId: role.id,
          panelId,
        });

        // Dodaj reakcję do wiadomości
        await message.react(emoji).catch(() => {
          throw new Error(t('commands.autorole.panel.create.invalid_emoji'));
        });

        // Zaktualizuj embed
        const updatedReactions = [...existingReactionsForPanel, { guildId: interaction.guildId, messageId, emoji, roleId: role.id, panelId }];

        const description = updatedReactions
          .map(r => `${r.emoji} → <@&${r.roleId}>`)
          .join('\n');

        const embed = new EmbedBuilder()
          .setTitle(panelId)
          .setDescription(description)
          .setColor(embedColor);

        await message.edit({ embeds: [embed] });

        return interaction.editReply({
          content: t('commands.autorole.panel.add_success', { emoji, roleId: role.id }),
        });
      } else {
        const embed = new EmbedBuilder()
          .setTitle(panelId)
          .setDescription(`${emoji} → <@&${role.id}> — ${desc}`)
          .setColor(embedColor);

        const message = await channel.send({ embeds: [embed] });

        if (!message) throw new Error('Could not send message.');

        await message.react(emoji).catch(() => {
          throw new Error(t('commands.autorole.panel.create.invalid_emoji'));
        });

        // Zapisz reakcję w DB z panelId
        await db.insert(autoroleReactions).values({
          guildId: interaction.guildId,
          messageId: message.id,
          emoji,
          roleId: role.id,
          panelId,
        });

        return interaction.editReply({
          content: t('commands.autorole.panel.add_success', { emoji, roleId: role.id }),
        });
      }
    } catch (error) {
      console.error('Error in autorole panel create:', error);
      await interaction.editReply({
        content: t('errors.unexpected'),
      });
    }
  }

  // /autorole panel list
  else if (subcommandGroup === 'panel' && subcommand === 'list') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const panelId = interaction.options.getString('panel_id');

      let entries;
      if (panelId) {
        entries = await db.query.autoroleReactions.findMany({
          where: and(
            eq(autoroleReactions.guildId, interaction.guildId),
            eq(autoroleReactions.panelId, panelId),
          ),
        });
      } else {
        // Pokaż wszystkie reakcje wszystkich paneli, pogrupowane po panelId
        entries = await db.query.autoroleReactions.findMany({
          where: eq(autoroleReactions.guildId, interaction.guildId),
        });
      }

      if (!entries.length) {
        await interaction.editReply({
          content: t('commands.autorole.panel.list.empty'),
        });
        return;
      }

      // Grupowanie po panelId
      const grouped = entries.reduce<Record<string, typeof entries>>((acc, item) => {
        if (!acc[item.panelId]) acc[item.panelId] = [];
        acc[item.panelId].push(item);
        return acc;
      }, {});

      let message = '';

      for (const [pid, reactions] of Object.entries(grouped)) {
        message += `**Panel ID:** \`${pid}\`\n`;
        for (const r of reactions) {
          message += `• ${r.emoji} → <@&${r.roleId}>\n`;
        }
        message += '\n';
      }

      await interaction.editReply({ content: message });
    } catch (error) {
      console.error('Error in autorole panel list:', error);
      await interaction.editReply({ content: t('errors.unexpected') });
    }
  }

  // /autorole panel remove
  else if (subcommandGroup === 'panel' && subcommand === 'remove') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const role = interaction.options.getRole('role', true) as Role;
      const panelId = interaction.options.getString('panel_id') ?? 'default';

      // Find the autorole reaction entry in DB for this guild, role and panelId
      const reaction = await db.query.autoroleReactions.findFirst({
        where: and(
          eq(autoroleReactions.guildId, interaction.guildId),
          eq(autoroleReactions.roleId, role.id),
          eq(autoroleReactions.panelId, panelId),
        ),
      });

      if (!reaction) {
        // No such reaction-role mapping found
        await interaction.editReply({
          content: t('commands.autorole.panel.not_found'),
        });
        return;
      }

      // Delete the reaction-role mapping from DB
      await db.delete(autoroleReactions).where(
        and(
          eq(autoroleReactions.guildId, interaction.guildId),
          eq(autoroleReactions.roleId, role.id),
          eq(autoroleReactions.panelId, panelId),
        )
      );

      const channel = interaction.channel;
      if (channel && channel.isTextBased()) {
        try {
          // Fetch the panel message where reactions are attached
          const message = await channel.messages.fetch(reaction.messageId);
          if (message) {
            // Find the reaction on the message that matches the stored emoji
            const reactionToRemove = message.reactions.cache.find(r => {
              // For unicode emoji, compare name directly
              if (r.emoji.name === reaction.emoji) return true;
              // For custom emoji, compare identifier
              return 'id' in r.emoji && r.emoji.id && r.emoji.identifier === reaction.emoji;
            });
            if (reactionToRemove) {
              // Remove the bot's own reaction from the message
              await reactionToRemove.users.remove(interaction.client.user!.id);
              // Alternatively, to remove the entire reaction (all users), use:
              // await reactionToRemove.remove();
            }

            // Update the embed description to remove the line with this emoji and role mention
            const embed = message.embeds[0];
            if (embed) {
              const lines = embed.description?.split('\n') ?? [];
              const filtered = lines.filter(line => !line.includes(reaction.emoji) && !line.includes(`<@&${role.id}>`));
              const newEmbed = EmbedBuilder.from(embed).setDescription(filtered.join('\n'));
              await message.edit({ embeds: [newEmbed] });
            }
          }
        } catch (error) {
          console.warn('Failed to fetch or edit the panel message:', error);
        }
      }

      await interaction.editReply({
        content: t('commands.autorole.panel.remove_success', { roleId: role.id }),
      });
    } catch (error) {
      console.error('Error in autorole panel remove:', error);
      await interaction.editReply({ content: t('errors.unexpected') });
    }
  }

}
