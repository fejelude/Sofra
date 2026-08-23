import {
  AuditLogEvent,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  escapeMarkdown,
} from "discord.js";

const SOFRA_PINK = 0xf4a7c2;
const SOFRA_LAVENDER = 0xd8b4e8;
const LOG_CHANNEL_PERMISSIONS = Object.freeze([
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.EmbedLinks,
]);

const ACTION_STYLES = Object.freeze({
  ban: { title: "Member Banned", emoji: "🔨", color: 0xe57373 },
  unban: { title: "Member Unbanned", emoji: "🌸", color: 0x81c784 },
  kick: { title: "Member Kicked", emoji: "🚪", color: 0xffb74d },
  warn: { title: "Official Warning", emoji: "⚠️", color: 0xf4a7c2 },
  timeout: { title: "Member Timed Out", emoji: "☁️", color: 0xb39ddb },
  untimeout: { title: "Timeout Removed", emoji: "✨", color: 0x81c784 },
  purge: { title: "Messages Purged", emoji: "🫧", color: 0x90caf9 },
  lockdown: { title: "Channel Locked", emoji: "🔒", color: 0xef9a9a },
  unlock: { title: "Channel Unlocked", emoji: "🔓", color: 0xa5d6a7 },
  slowmode: { title: "Slowmode Updated", emoji: "⏳", color: 0xce93d8 },
  permissions: {
    title: "Channel Permissions Updated",
    emoji: "🛡️",
    color: 0xb0bec5,
  },
  test: { title: "Moderation Log Preview", emoji: "🎀", color: SOFRA_PINK },
});

function safe(value, fallback = "Unknown") {
  return escapeMarkdown(String(value ?? fallback)).replaceAll("@", "@\u200b");
}

function identity(entity, fallbackId = null) {
  const id = entity?.id ?? fallbackId;
  const name = entity?.tag ?? entity?.username ?? entity?.displayName ?? null;
  if (id && name) return `**${safe(name)}**\n\`${id}\``;
  if (id) return `<@${id}>\n\`${id}\``;
  return "Unknown";
}

function channelIdentity(channel, fallbackId = null) {
  const id = channel?.id ?? fallbackId;
  if (!id) return null;
  return `<#${id}>\n\`${id}\``;
}

function displayReason(reason) {
  return safe(reason?.trim() || "No reason provided").slice(0, 1_024);
}

function auditChange(entry, key) {
  return entry.changes?.find((change) => change.key === key) ?? null;
}

function secondsLabel(seconds) {
  if (!seconds) return "Disabled";
  return `${seconds.toLocaleString("en-US")} second(s)`;
}

export function buildModLogEmbed({
  action,
  moderator,
  moderatorId,
  target,
  targetId,
  reason,
  channel,
  channelId,
  details,
  source = "Sofra command",
  timestamp = Date.now(),
}) {
  const style = ACTION_STYLES[action] ?? {
    title: "Moderation Action",
    emoji: "୨୧",
    color: SOFRA_LAVENDER,
  };
  const embed = new EmbedBuilder()
    .setColor(style.color)
    .setAuthor({ name: "♡ Sofra Staff Logs" })
    .setTitle(`${style.emoji} ${style.title}`)
    .addFields(
      {
        name: "🎀 Moderator",
        value: identity(moderator, moderatorId),
        inline: true,
      },
      { name: "🌸 Target", value: identity(target, targetId), inline: true },
      { name: "୨୧ Source", value: safe(source), inline: true },
      { name: "📝 Reason", value: displayReason(reason), inline: false },
    )
    .setFooter({ text: "Sofra ♡ Moderation Record" })
    .setTimestamp(timestamp);
  const channelValue = channelIdentity(channel, channelId);
  if (channelValue) {
    embed.addFields({ name: "☁️ Channel", value: channelValue, inline: true });
  }
  if (details) {
    embed.addFields({
      name: "✨ Details",
      value: safe(details).slice(0, 1_024),
      inline: false,
    });
  }
  return embed;
}

export class ModLogService {
  constructor({ client, store, logger }) {
    this.client = client;
    this.store = store;
    this.logger = logger;
  }

  async handleInteraction(interaction) {
    if (!interaction.isChatInputCommand() || interaction.commandName !== "modlog") {
      return false;
    }

    const subcommand = interaction.options.getSubcommand();
    try {
      if (!interaction.inGuild() || !interaction.guild) {
        await interaction.reply({
          content: "୨୧ Moderation logging can only be configured inside a server.",
          flags: MessageFlags.Ephemeral,
        });
        return true;
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.editReply("You need **Manage Server** to configure staff logs.");
        return true;
      }
      if (!this.store.getHealth().ok) {
        await interaction.editReply(
          "Moderation-log storage is unavailable. Check disk space and the Wispbyte console.",
        );
        return true;
      }
      await this[subcommand](interaction);
      return true;
    } catch (error) {
      this.logger.error(
        "MODLOG_COMMAND_FAILED",
        `The /modlog ${subcommand} command failed safely.`,
        error,
        { guildId: interaction.guildId, userId: interaction.user?.id },
      );
      await this.replyWithFailure(interaction);
      return true;
    }
  }

  async setup(interaction) {
    const guild = interaction.guild;
    const botMember = guild.members.me;
    if (
      !botMember?.permissions.has(PermissionFlagsBits.ManageChannels) ||
      !botMember.permissions.has(PermissionFlagsBits.ManageRoles)
    ) {
      await interaction.editReply(
        "Sofra needs **Manage Channels** and **Manage Roles** before she can create the private staff-log area.",
      );
      return;
    }

    let category = guild.channels.cache.find(
      (channel) =>
        channel.type === ChannelType.GuildCategory &&
        channel.name.toLowerCase() === "moderation",
    );
    if (!category) {
      category = await guild.channels.create({
        name: "Moderation",
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
          { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
          {
            id: this.client.user.id,
            allow: LOG_CHANNEL_PERMISSIONS,
          },
        ],
        reason: `Sofra mod-log setup by ${interaction.user.tag} (${interaction.user.id})`,
      });
    }

    let channel = guild.channels.cache.find(
      (candidate) =>
        candidate.type === ChannelType.GuildText &&
        candidate.parentId === category.id &&
        candidate.name === "staff-logs",
    );
    if (!channel) {
      channel = await guild.channels.create({
        name: "staff-logs",
        type: ChannelType.GuildText,
        parent: category.id,
        topic: "Private moderation actions recorded by Sofra ♡",
        reason: `Sofra mod-log setup by ${interaction.user.tag} (${interaction.user.id})`,
      });
    }
    await channel.permissionOverwrites.edit(
      guild.roles.everyone,
      { ViewChannel: false },
      { reason: "Keep Sofra moderation logs private" },
    );
    await channel.permissionOverwrites.edit(
      this.client.user.id,
      {
        ViewChannel: true,
        SendMessages: true,
        EmbedLinks: true,
      },
      { reason: "Allow Sofra to write moderation logs" },
    );

    const validation = this.validateChannel(guild, channel);
    if (!validation.valid) {
      await interaction.editReply(
        `${channel} was found, but Sofra is missing: **${validation.missing.join(", ")}**.`,
      );
      return;
    }
    this.store.setModLogChannel(guild.id, channel.id);
    this.store.setModLogEnabled(guild.id, true);
    await this.sendLog(guild, {
      action: "test",
      moderator: interaction.user,
      target: this.client.user,
      reason: "Moderation logging was configured successfully.",
      channel,
      details: "Automatic staff logging is now enabled.",
    });
    await interaction.editReply(
      `🎀 Created/configured **Moderation → ${channel}** and enabled moderation logging. Add your staff roles to the private category if needed.`,
    );
  }

  async channel(interaction) {
    const channel = interaction.options.getChannel("channel", true);
    const validation = this.validateChannel(interaction.guild, channel);
    if (!validation.valid) {
      await interaction.editReply(
        `That channel is not ready. Sofra is missing: **${validation.missing.join(", ")}**.`,
      );
      return;
    }
    const config = this.store.setModLogChannel(interaction.guild.id, channel.id);
    await interaction.editReply(
      `🌸 Moderation logs will use ${channel}. Logging is currently **${config.enabled ? "enabled" : "disabled"}**.`,
    );
  }

  async enable(interaction) {
    const config = this.store.getModLogConfig(interaction.guild.id);
    const channel = await this.resolveChannel(interaction.guild, config.channelId);
    const validation = this.validateChannel(interaction.guild, channel);
    if (!config.channelId || !validation.valid) {
      await interaction.editReply(
        "Choose a valid channel with `/modlog channel`, or run `/modlog setup` first.",
      );
      return;
    }
    this.store.setModLogEnabled(interaction.guild.id, true);
    await interaction.editReply(`✨ Moderation logging is enabled in ${channel}.`);
  }

  async disable(interaction) {
    this.store.setModLogEnabled(interaction.guild.id, false);
    await interaction.editReply("☁️ Moderation logging is disabled. The saved channel was kept.");
  }

  async test(interaction) {
    const sent = await this.sendLog(
      interaction.guild,
      {
        action: "test",
        moderator: interaction.user,
        target: this.client.user,
        reason: "Preview requested by a server administrator.",
        channel: interaction.channel,
        details: "If you can see this embed, Sofra's staff log is working.",
      },
      { force: true },
    );
    await interaction.editReply(
      sent
        ? "🩷 Preview sent successfully."
        : "The preview could not be sent. Run `/modlog status` for diagnostics.",
    );
  }

  async status(interaction) {
    const config = this.store.getModLogConfig(interaction.guild.id);
    const channel = await this.resolveChannel(interaction.guild, config.channelId);
    const validation = this.validateChannel(interaction.guild, channel);
    const auditAccess = interaction.guild.members.me?.permissions.has(
      PermissionFlagsBits.ViewAuditLog,
    );
    const valid = Boolean(config.channelId && validation.valid && auditAccess);
    const embed = new EmbedBuilder()
      .setColor(valid ? 0x81c784 : SOFRA_PINK)
      .setAuthor({ name: "♡ Sofra Moderation Logs" })
      .setTitle("୨୧ Staff Log Status")
      .addFields(
        { name: "🎀 Enabled", value: config.enabled ? "Yes" : "No", inline: true },
        {
          name: "🌸 Channel",
          value: channel ? `${channel}` : "Not configured",
          inline: true,
        },
        {
          name: "☁️ Storage",
          value: this.store.getHealth().ok ? "Healthy" : "Unavailable",
          inline: true,
        },
        {
          name: "✨ Channel Access",
          value: validation.valid
            ? "View Channel, Send Messages, Embed Links"
            : validation.missing.join(", ") || "Invalid or deleted channel",
          inline: false,
        },
        {
          name: "🛡️ Manual Action Detection",
          value: auditAccess ? "View Audit Log available" : "Missing View Audit Log",
          inline: false,
        },
        {
          name: "୨୧ Configuration Valid",
          value: valid ? "Yes — ready to log" : "No — review the diagnostics above",
          inline: false,
        },
      )
      .setFooter({ text: "Sofra ♡ Private Staff Logs" })
      .setTimestamp();
    await interaction.editReply({ embeds: [embed], allowedMentions: { parse: [] } });
  }

  async logAction(guild, payload) {
    try {
      return await this.sendLog(guild, payload);
    } catch (error) {
      this.logger.error(
        "MODLOG_SEND_FAILED",
        "A moderation action completed, but its staff log could not be sent.",
        error,
        { guildId: guild?.id, action: payload?.action },
      );
      return false;
    }
  }

  async sendLog(guild, payload, { force = false } = {}) {
    if (!this.store.getHealth().ok) return false;
    const config = this.store.getModLogConfig(guild.id);
    if (!force && !config.enabled) return false;
    const channel = await this.resolveChannel(guild, config.channelId);
    if (!this.validateChannel(guild, channel).valid) return false;
    await channel.send({
      embeds: [buildModLogEmbed(payload)],
      allowedMentions: { parse: [] },
    });
    return true;
  }

  async handleAuditLogEntry(entry, guild) {
    try {
      if (!guild || entry.executorId === this.client.user.id) return;
      const payload = this.auditPayload(entry);
      if (!payload) return;
      await this.logAction(guild, payload);
    } catch (error) {
      this.logger.error(
        "MODLOG_AUDIT_EVENT_FAILED",
        "A Discord audit-log event could not be mirrored safely.",
        error,
        { guildId: guild?.id, auditAction: entry?.action },
      );
    }
  }

  auditPayload(entry) {
    const base = {
      moderator: entry.executor,
      moderatorId: entry.executorId,
      target: entry.target,
      targetId: entry.targetId,
      reason: entry.reason,
      source: "Discord audit log",
      timestamp: entry.createdTimestamp,
    };
    if (entry.action === AuditLogEvent.MemberBanAdd) return { ...base, action: "ban" };
    if (entry.action === AuditLogEvent.MemberBanRemove) return { ...base, action: "unban" };
    if (entry.action === AuditLogEvent.MemberKick) return { ...base, action: "kick" };
    if (entry.action === AuditLogEvent.MessageBulkDelete) {
      return {
        ...base,
        action: "purge",
        target: null,
        channel: entry.target,
        channelId: entry.targetId,
        details: `${entry.extra?.count ?? "Unknown"} message(s) removed`,
      };
    }
    if (entry.action === AuditLogEvent.MemberUpdate) {
      const timeout = auditChange(entry, "communication_disabled_until");
      if (!timeout) return null;
      const ended = timeout.new === null || timeout.new === undefined;
      return {
        ...base,
        action: ended ? "untimeout" : "timeout",
        details: ended
          ? "Timeout removed manually"
          : `Timeout until ${new Date(timeout.new).toLocaleString("en-US", { timeZone: "UTC" })} UTC`,
      };
    }
    if (entry.action === AuditLogEvent.ChannelUpdate) {
      const slowmode = auditChange(entry, "rate_limit_per_user");
      if (!slowmode) return null;
      return {
        ...base,
        action: "slowmode",
        channel: entry.target,
        channelId: entry.targetId,
        target: null,
        details: `${secondsLabel(slowmode.old)} → ${secondsLabel(slowmode.new)}`,
      };
    }
    if (entry.action === AuditLogEvent.ChannelOverwriteUpdate) {
      return {
        ...base,
        action: "permissions",
        channel: entry.target,
        channelId: entry.targetId,
        details: "A channel permission overwrite was updated.",
      };
    }
    return null;
  }

  async handleChannelDelete(channel) {
    if (!channel.guild || !this.store.getHealth().ok) return;
    try {
      const config = this.store.getModLogConfig(channel.guild.id);
      if (config.channelId === channel.id) {
        this.store.clearModLogChannel(channel.guild.id);
        this.logger.warn(
          "MODLOG_CHANNEL_DELETED",
          "The configured staff-log channel was deleted.",
          {
            guildId: channel.guild.id,
            channelId: channel.id,
          },
        );
      }
    } catch (error) {
      this.logger.error(
        "MODLOG_CHANNEL_DELETE_FAILED",
        "A deleted staff-log channel could not be cleared from configuration.",
        error,
        { guildId: channel.guild.id, channelId: channel.id },
      );
    }
  }

  validateChannel(guild, channel) {
    const missing = [];
    if (
      !channel ||
      channel.guildId !== guild.id ||
      ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type) ||
      typeof channel.send !== "function"
    ) {
      return { valid: false, missing: ["valid text channel"] };
    }
    const permissions = channel.permissionsFor(guild.members.me);
    const names = new Map([
      [PermissionFlagsBits.ViewChannel, "View Channel"],
      [PermissionFlagsBits.SendMessages, "Send Messages"],
      [PermissionFlagsBits.EmbedLinks, "Embed Links"],
    ]);
    for (const permission of LOG_CHANNEL_PERMISSIONS) {
      if (!permissions?.has(permission)) missing.push(names.get(permission));
    }
    return { valid: missing.length === 0, missing };
  }

  async resolveChannel(guild, channelId) {
    if (!channelId) return null;
    return (
      guild.channels.cache.get(channelId) ??
      (await guild.channels.fetch(channelId).catch(() => null))
    );
  }

  async replyWithFailure(interaction) {
    try {
      await interaction.editReply(
        "Sofra couldn't update moderation logging. Nothing else crashed—check permissions, disk space, and the Wispbyte console.",
      );
    } catch (replyError) {
      this.logger.error(
        "MODLOG_REPLY_FAILED",
        "Discord rejected a moderation-log error response.",
        replyError,
        { guildId: interaction.guildId },
      );
    }
  }
}
