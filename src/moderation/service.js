import {
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  escapeMarkdown,
} from "discord.js";

const SNOWFLAKE_PATTERN = /^\d{17,20}$/;
const MAX_PURGE_ALL = 1_000;
const SOFRA_PINK = 0xf4a7c2;
const COMMAND_PERMISSIONS = Object.freeze({
  purge: PermissionFlagsBits.ManageMessages,
  ban: PermissionFlagsBits.BanMembers,
  kick: PermissionFlagsBits.KickMembers,
  mute: PermissionFlagsBits.ModerateMembers,
  warn: PermissionFlagsBits.ModerateMembers,
  warnings: PermissionFlagsBits.ModerateMembers,
  unban: PermissionFlagsBits.BanMembers,
  unmute: PermissionFlagsBits.ModerateMembers,
  lockdown: PermissionFlagsBits.ManageChannels,
  unlock: PermissionFlagsBits.ManageChannels,
  slowmode: PermissionFlagsBits.ManageChannels,
});

function auditReason(interaction, reason) {
  const detail = reason?.trim() || "No reason provided";
  return `${detail} • Actioned by ${interaction.user.tag} (${interaction.user.id})`.slice(
    0,
    512,
  );
}

function displayReason(reason) {
  return escapeMarkdown(reason?.trim() || "No reason provided").replaceAll(
    "@",
    "@\u200b",
  );
}

function formatDuration(totalMinutes) {
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;
  return [
    days > 0 ? `${days}d` : null,
    hours > 0 ? `${hours}h` : null,
    minutes > 0 ? `${minutes}m` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

function permissionOverwriteState(overwrite, permission) {
  if (!overwrite) return null;
  if (overwrite.allow.has(permission)) return true;
  if (overwrite.deny.has(permission)) return false;
  return null;
}

export class ModerationService {
  constructor({ client, store, logger, modLogService = null }) {
    this.client = client;
    this.store = store;
    this.logger = logger;
    this.modLogService = modLogService;
  }

  async handleInteraction(interaction) {
    if (
      !interaction.isChatInputCommand() ||
      !Object.hasOwn(COMMAND_PERMISSIONS, interaction.commandName)
    ) {
      return false;
    }

    const command = interaction.commandName;
    try {
      if (!interaction.inGuild() || !interaction.guild) {
        await interaction.reply({
          content: "୨୧ Moderation commands can only be used inside a server.",
          flags: MessageFlags.Ephemeral,
        });
        return true;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      if (!interaction.memberPermissions?.has(COMMAND_PERMISSIONS[command])) {
        await interaction.editReply(
          "You do not have the Discord permission required for that moderation action.",
        );
        return true;
      }

      await this[command](interaction);
      return true;
    } catch (error) {
      this.logger.error(
        "MODERATION_COMMAND_FAILED",
        `/${command} failed without affecting Sofra’s other features.`,
        error,
        { guildId: interaction.guildId, userId: interaction.user?.id, command },
      );
      await this.replyWithFailure(interaction, command);
      return true;
    }
  }

  async purge(interaction) {
    const channel = interaction.channel;
    const requested = interaction.options.getString("messages", true).toLowerCase();
    if (!channel || typeof channel.bulkDelete !== "function") {
      await interaction.editReply("Use this command in a text channel with message history.");
      return;
    }

    const permissions = channel.permissionsFor(interaction.guild.members.me);
    const required = [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.ManageMessages,
    ];
    if (!permissions || required.some((permission) => !permissions.has(permission))) {
      await interaction.editReply(
        "Sofra needs **View Channel**, **Read Message History**, and **Manage Messages** here.",
      );
      return;
    }

    let deleted = 0;
    if (requested === "all") {
      while (deleted < MAX_PURGE_ALL) {
        const batch = await channel.bulkDelete(
          Math.min(100, MAX_PURGE_ALL - deleted),
          true,
        );
        deleted += batch.size;
        if (batch.size < 100) break;
      }
    } else if (/^(?:[1-9]\d?|100)$/.test(requested)) {
      deleted = (await channel.bulkDelete(Number(requested), true)).size;
    } else {
      await interaction.editReply('Enter a number from **1–100**, or enter **all**.');
      return;
    }

    const limitNote = requested === "all" ? " Discord only bulk-deletes messages newer than 14 days; each run is capped at 1,000." : " Messages older than 14 days are skipped by Discord.";
    await this.logAction(interaction, {
      action: "purge",
      channel,
      reason: "Bulk message cleanup",
      details: `${deleted} message(s) deleted • requested: ${requested}`,
    });
    await interaction.editReply(`🫧 Deleted **${deleted}** message(s).${limitNote}`);
  }

  async ban(interaction) {
    const user = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason") || "No reason provided";
    const deleteDays = interaction.options.getInteger("delete-message-days") ?? 0;
    if (!(await this.canActOnUser(interaction, user, "ban"))) return;

    await interaction.guild.members.ban(user.id, {
      deleteMessageSeconds: deleteDays * 86_400,
      reason: auditReason(interaction, reason),
    });
    await this.logAction(interaction, {
      action: "ban",
      target: user,
      reason,
      details: `Deleted message history: ${deleteDays} day(s)`,
    });
    const dmSent = await this.sendModerationDm(user, {
      guild: interaction.guild,
      action: "You were banned",
      reason,
      detail: "You may contact the server staff if you believe this was a mistake.",
    });
    await interaction.editReply(
      `🎀 **${escapeMarkdown(user.tag)}** was banned.${dmSent ? " They were notified privately." : " Their DMs were closed, so the private notice could not be delivered."}`,
    );
  }

  async kick(interaction) {
    const member = await this.resolveTargetMember(interaction);
    if (!member || !(await this.canActOnMember(interaction, member, "kick"))) return;
    const reason = interaction.options.getString("reason") || "No reason provided";
    await member.kick(auditReason(interaction, reason));
    await this.logAction(interaction, {
      action: "kick",
      target: member.user,
      reason,
    });
    const dmSent = await this.sendModerationDm(member.user, {
      guild: interaction.guild,
      action: "You were removed from the server",
      reason,
      detail: "You can rejoin later if the server staff allow it.",
    });
    await interaction.editReply(
      `🌸 **${escapeMarkdown(member.user.tag)}** was kicked.${dmSent ? " They were notified privately." : " Their DMs were closed."}`,
    );
  }

  async mute(interaction) {
    const member = await this.resolveTargetMember(interaction);
    if (!member || !(await this.canActOnMember(interaction, member, "mute"))) return;
    const minutes = interaction.options.getInteger("duration-minutes", true);
    const reason = interaction.options.getString("reason") || "No reason provided";
    await member.timeout(minutes * 60_000, auditReason(interaction, reason));
    await this.logAction(interaction, {
      action: "timeout",
      target: member.user,
      reason,
      details: `Duration: ${formatDuration(minutes)}`,
    });
    const dmSent = await this.sendModerationDm(member.user, {
      guild: interaction.guild,
      action: "You were temporarily muted",
      reason,
      detail: `Duration: ${formatDuration(minutes)}. Discord will restore your access automatically.`,
    });
    await interaction.editReply(
      `☁️ **${escapeMarkdown(member.user.tag)}** was muted for **${formatDuration(minutes)}**.${dmSent ? " A private notice was sent." : " Their DMs were closed."}`,
    );
  }

  async unmute(interaction) {
    const member = await this.resolveTargetMember(interaction);
    if (!member || !(await this.canActOnMember(interaction, member, "unmute"))) return;
    const reason = interaction.options.getString("reason") || "No reason provided";
    await member.timeout(null, auditReason(interaction, reason));
    await this.logAction(interaction, {
      action: "untimeout",
      target: member.user,
      reason,
      details: "Timeout ended before its automatic expiration.",
    });
    const dmSent = await this.sendModerationDm(member.user, {
      guild: interaction.guild,
      action: "Your mute was removed",
      reason,
      detail: "Your text and voice privileges have been restored.",
    });
    await interaction.editReply(
      `✨ **${escapeMarkdown(member.user.tag)}** was unmuted.${dmSent ? " A private notice was sent." : " Their DMs were closed."}`,
    );
  }

  async warn(interaction) {
    if (!this.store.getHealth().ok) {
      await interaction.editReply(
        "Warning storage is unavailable. Nothing was recorded; check the Wispbyte console and disk space.",
      );
      return;
    }
    const member = await this.resolveTargetMember(interaction);
    if (!member || !(await this.canActOnMember(interaction, member, "warn"))) return;
    const reason = interaction.options.getString("reason", true);
    const warning = this.store.addWarning({
      guildId: interaction.guild.id,
      userId: member.id,
      moderatorId: interaction.user.id,
      reason,
    });
    await this.logAction(interaction, {
      action: "warn",
      target: member.user,
      reason,
      details: `Total recorded offenses: ${warning.total}`,
    });
    const dmSent = await this.sendModerationDm(member.user, {
      guild: interaction.guild,
      action: "You received an official warning",
      reason,
      detail: "Please review the rules and avoid repeating the behavior.",
    });
    await interaction.editReply(
      `🩷 Warning recorded privately for **${escapeMarkdown(member.user.tag)}**. Total offenses: **${warning.total}**.${dmSent ? " The member received Sofra’s DM." : " Their DMs were closed, but the warning is still recorded."}`,
    );
  }

  async warnings(interaction) {
    if (!this.store.getHealth().ok) {
      await interaction.editReply("Warning storage is unavailable. Check the Wispbyte console.");
      return;
    }
    const user = interaction.options.getUser("member", true);
    const warnings = this.store.getWarnings(interaction.guild.id, user.id, 10);
    const description = warnings.history.length
      ? warnings.history
          .map(
            (warning) =>
              `**#${warning.id}** • <t:${Math.floor(warning.createdAt / 1_000)}:f> • by <@${warning.moderatorId}>\n> ${displayReason(warning.reason).slice(0, 250)}`,
          )
          .join("\n\n")
      : "No warnings are recorded for this member.";
    const embed = new EmbedBuilder()
      .setColor(SOFRA_PINK)
      .setTitle(`୨୧ Private Warning Record — ${escapeMarkdown(user.username)}`)
      .setDescription(description)
      .addFields({ name: "🎀 Total Offenses", value: String(warnings.total) })
      .setFooter({ text: "Only moderators can view this response • Sofra ♡" })
      .setTimestamp();
    await interaction.editReply({ embeds: [embed], allowedMentions: { parse: [] } });
  }

  async unban(interaction) {
    const userId = interaction.options.getString("user-id", true).trim();
    if (!SNOWFLAKE_PATTERN.test(userId)) {
      await interaction.editReply("Enter a valid Discord user ID containing 17–20 digits.");
      return;
    }
    const reason = interaction.options.getString("reason") || "No reason provided";
    const ban = await interaction.guild.bans.fetch(userId).catch(() => null);
    if (!ban) {
      await interaction.editReply("That user ID is not currently banned from this server.");
      return;
    }
    await interaction.guild.bans.remove(userId, auditReason(interaction, reason));
    await this.logAction(interaction, {
      action: "unban",
      target: ban.user,
      targetId: userId,
      reason,
    });
    await interaction.editReply(
      `🌸 **${escapeMarkdown(ban.user.tag)}** (${userId}) was unbanned.`,
    );
  }

  async lockdown(interaction) {
    if (!this.store.getHealth().ok) {
      await interaction.editReply(
        "Lockdown storage is unavailable, so Sofra will not change channel permissions unsafely.",
      );
      return;
    }
    const channel = interaction.options.getChannel("channel") ?? interaction.channel;
    if (!(await this.isManageableChannel(interaction, channel))) return;
    if (this.store.getLockdown(interaction.guild.id, channel.id)) {
      await interaction.editReply(`${channel} is already recorded as locked down.`);
      return;
    }

    const everyone = interaction.guild.roles.everyone;
    const overwrite = channel.permissionOverwrites.cache.get(everyone.id);
    const previous = permissionOverwriteState(
      overwrite,
      PermissionFlagsBits.SendMessages,
    );
    const previousInThreads = permissionOverwriteState(
      overwrite,
      PermissionFlagsBits.SendMessagesInThreads,
    );
    const saved = this.store.saveLockdown({
      guildId: interaction.guild.id,
      channelId: channel.id,
      previousSendMessages: previous,
      previousSendMessagesInThreads: previousInThreads,
      lockedBy: interaction.user.id,
    });
    if (!saved) {
      await interaction.editReply(`${channel} is already recorded as locked down.`);
      return;
    }

    const reason = interaction.options.getString("reason") || "Emergency channel lockdown";
    try {
      await channel.permissionOverwrites.edit(
        everyone,
        { SendMessages: false, SendMessagesInThreads: false },
        { reason: auditReason(interaction, reason) },
      );
    } catch (error) {
      this.store.removeLockdown(interaction.guild.id, channel.id);
      throw error;
    }
    await this.logAction(interaction, {
      action: "lockdown",
      channel,
      reason,
      details: "Send Messages and Send Messages in Threads denied for @everyone.",
    });
    await interaction.editReply(`🔒 ${channel} is now locked for normal members.`);
  }

  async unlock(interaction) {
    if (!this.store.getHealth().ok) {
      await interaction.editReply("Lockdown storage is unavailable. No permissions were changed.");
      return;
    }
    const channel = interaction.options.getChannel("channel") ?? interaction.channel;
    if (!(await this.isManageableChannel(interaction, channel))) return;
    const lockdown = this.store.getLockdown(interaction.guild.id, channel.id);
    if (!lockdown) {
      await interaction.editReply(
        `${channel} has no Sofra lockdown record, so its permissions were left untouched.`,
      );
      return;
    }

    const reason = interaction.options.getString("reason") || "Channel lockdown ended";
    await channel.permissionOverwrites.edit(
      interaction.guild.roles.everyone,
      {
        SendMessages: lockdown.previousSendMessages,
        SendMessagesInThreads: lockdown.previousSendMessagesInThreads,
      },
      { reason: auditReason(interaction, reason) },
    );
    this.store.removeLockdown(interaction.guild.id, channel.id);
    await this.logAction(interaction, {
      action: "unlock",
      channel,
      reason,
      details: "The exact pre-lockdown typing permissions were restored.",
    });
    await interaction.editReply(`🔓 ${channel} was restored to its pre-lockdown state.`);
  }

  async slowmode(interaction) {
    const channel = interaction.options.getChannel("channel") ?? interaction.channel;
    if (!(await this.isManageableChannel(interaction, channel, true))) return;
    const seconds = interaction.options.getInteger("seconds", true);
    const reason = interaction.options.getString("reason") || "Slowmode updated";
    await channel.setRateLimitPerUser(seconds, auditReason(interaction, reason));
    await this.logAction(interaction, {
      action: "slowmode",
      channel,
      reason,
      details: seconds === 0 ? "Slowmode disabled" : `${seconds} second cooldown`,
    });
    await interaction.editReply(
      seconds === 0
        ? `🫧 Slowmode was disabled in ${channel}.`
        : `⏳ Slowmode in ${channel} is now **${seconds} second(s)**.`,
    );
  }

  async handleChannelDelete(channel) {
    if (!channel.guild || !this.store.getHealth().ok) return;
    try {
      this.store.removeLockdown(channel.guild.id, channel.id);
    } catch (error) {
      this.logger.error(
        "LOCKDOWN_DELETE_CLEANUP_FAILED",
        "A deleted channel could not be removed from lockdown storage.",
        error,
        { guildId: channel.guild.id, channelId: channel.id },
      );
    }
  }

  async resolveTargetMember(interaction) {
    const user = interaction.options.getUser("member", true);
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) {
      await interaction.editReply("That user is not currently a member of this server.");
    }
    return member;
  }

  async canActOnUser(interaction, user, action) {
    if (user.id === interaction.user.id) {
      await interaction.editReply(`You cannot ${action} yourself.`);
      return false;
    }
    if (user.id === this.client.user.id || user.id === interaction.guild.ownerId) {
      await interaction.editReply(`Sofra cannot ${action} that user.`);
      return false;
    }
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    return member ? this.canActOnMember(interaction, member, action) : true;
  }

  async canActOnMember(interaction, member, action) {
    if (member.id === interaction.user.id) {
      await interaction.editReply(`You cannot ${action} yourself.`);
      return false;
    }
    if (member.id === interaction.guild.ownerId || member.id === this.client.user.id) {
      await interaction.editReply(`Sofra cannot ${action} that member.`);
      return false;
    }

    const [actor, bot] = await Promise.all([
      interaction.guild.members.fetch(interaction.user.id),
      interaction.guild.members.me ?? interaction.guild.members.fetch(this.client.user.id),
    ]);
    if (
      actor.id !== interaction.guild.ownerId &&
      actor.roles.highest.comparePositionTo(member.roles.highest) <= 0
    ) {
      await interaction.editReply(
        `You cannot ${action} a member with an equal or higher role than yours.`,
      );
      return false;
    }
    if (bot.roles.highest.comparePositionTo(member.roles.highest) <= 0) {
      await interaction.editReply(
        `Move Sofra’s highest role above that member before using /${interaction.commandName}.`,
      );
      return false;
    }

    const property = action === "kick" ? "kickable" : action === "ban" ? "bannable" : "moderatable";
    if (["kick", "ban", "mute", "unmute"].includes(action) && !member[property]) {
      await interaction.editReply(`Discord does not currently allow Sofra to ${action} that member.`);
      return false;
    }
    return true;
  }

  async isManageableChannel(interaction, channel, needsSlowmode = false) {
    const supported =
      channel &&
      channel.guildId === interaction.guild.id &&
      typeof channel.permissionOverwrites?.edit === "function" &&
      (!needsSlowmode || typeof channel.setRateLimitPerUser === "function");
    if (!supported) {
      await interaction.editReply("Choose a regular text or announcement channel.");
      return false;
    }
    const permissions = channel.permissionsFor(interaction.guild.members.me);
    const requiredPermission = needsSlowmode
      ? PermissionFlagsBits.ManageChannels
      : PermissionFlagsBits.ManageRoles;
    const permissionName = needsSlowmode ? "Manage Channels" : "Manage Roles";
    if (!permissions?.has(requiredPermission)) {
      await interaction.editReply(`Sofra needs **${permissionName}** permission in ${channel}.`);
      return false;
    }
    return true;
  }

  async sendModerationDm(user, { guild, action, reason, detail }) {
    const embed = new EmbedBuilder()
      .setColor(SOFRA_PINK)
      .setAuthor({
        name: "♡ A message from Sofra",
        iconURL: this.client.user.displayAvatarURL({ extension: "png", size: 128 }),
      })
      .setTitle(`୨୧ ${action}`)
      .setDescription(
        `This moderation action was issued in **${escapeMarkdown(guild.name)}**.\n\n` +
          `🌸 **Reason**\n${displayReason(reason)}\n\n` +
          `☁️ ${detail}`,
      )
      .setFooter({ text: "Please follow the server rules • Sofra ♡" })
      .setTimestamp();
    try {
      await user.send({ embeds: [embed], allowedMentions: { parse: [] } });
      return true;
    } catch {
      return false;
    }
  }

  async logAction(interaction, payload) {
    if (!this.modLogService) return false;
    return this.modLogService.logAction(interaction.guild, {
      ...payload,
      moderator: interaction.user,
      source: "Sofra command",
    });
  }

  async replyWithFailure(interaction, command) {
    try {
      await interaction.editReply(
        `Sofra couldn’t complete /${command}. Nothing else crashed—check permissions, role hierarchy, disk space, and the Wispbyte console.`,
      );
    } catch (replyError) {
      this.logger.error(
        "MODERATION_REPLY_FAILED",
        "Discord rejected a moderation error response.",
        replyError,
        { guildId: interaction.guildId, command },
      );
    }
  }
}
