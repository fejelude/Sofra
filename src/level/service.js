import { randomInt } from "node:crypto";
import {
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
} from "discord.js";
import {
  inspectLevelChannel,
  inspectLevelChannelObject,
  isConfigurableLevelChannel,
} from "./channel.js";
import { PUBLIC_LEVEL_SUBCOMMANDS } from "./command.js";
import {
  buildLeaderboardEmbed,
  buildLevelUpEmbed,
  buildRankEmbed,
  buildRewardsEmbed,
  LEVEL_COLORS,
} from "./embeds.js";
import { levelFromXp, totalXpForLevel } from "./math.js";
import { grantEligibleRoleRewards, inspectRewardRole } from "./roles.js";

const LEADERBOARD_PAGE_SIZE = 10;
const PROCESSED_MESSAGE_TTL_MS = 10 * 60_000;
const MAX_PROCESSED_MESSAGES = 5_000;

function yesOrNo(value) {
  return value ? "✅ Yes" : "❌ No";
}

function missingChannelPermissions(inspection) {
  const missing = [];
  if (!inspection.viewChannel) missing.push("View Channel");
  if (!inspection.sendMessages) missing.push("Send Messages");
  if (!inspection.embedLinks) missing.push("Embed Links");
  return missing;
}

export class LevelService {
  constructor({ client, store, logger }) {
    this.client = client;
    this.store = store;
    this.logger = logger;
    this.processedMessages = new Map();
  }

  async handleInteraction(interaction) {
    if (!interaction.isChatInputCommand() || interaction.commandName !== "level") {
      return false;
    }

    let isPublic = false;

    try {
      if (!interaction.inGuild() || !interaction.guild) {
        await interaction.reply({
          content: "୨୧ The level system can only be used inside a server.",
          flags: MessageFlags.Ephemeral,
        });
        return true;
      }

      const subcommand = interaction.options.getSubcommand(true);
      isPublic = PUBLIC_LEVEL_SUBCOMMANDS.has(subcommand);
      if (isPublic) {
        await interaction.deferReply();
      } else {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      }

      if (
        !isPublic &&
        !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
      ) {
        await interaction.editReply(
          "You need **Manage Server** permission to configure Sofra’s level system.",
        );
        return true;
      }

      if (subcommand === "rank") {
        await this.rank(interaction);
      } else if (subcommand === "leaderboard") {
        await this.leaderboard(interaction);
      } else if (subcommand === "rewards") {
        await this.rewards(interaction);
      } else if (subcommand === "enable") {
        await this.enable(interaction);
      } else if (subcommand === "disable") {
        await this.disable(interaction);
      } else if (subcommand === "channel") {
        await this.configureChannel(interaction);
      } else if (subcommand === "channel-reset") {
        await this.resetChannel(interaction);
      } else if (subcommand === "settings") {
        await this.settings(interaction);
      } else if (subcommand === "role-add") {
        await this.addRoleReward(interaction);
      } else if (subcommand === "role-remove") {
        await this.removeRoleReward(interaction);
      } else if (subcommand === "test") {
        await this.testNotification(interaction);
      } else if (subcommand === "status") {
        await this.status(interaction);
      } else {
        await interaction.editReply("That level subcommand is not supported.");
      }

      return true;
    } catch (error) {
      this.logger.error(
        "LEVEL_COMMAND_FAILED",
        "A /level command failed without affecting the welcome system or Discord client.",
        error,
        {
          guildId: interaction.guildId,
          userId: interaction.user?.id,
          subcommand: interaction.options?.getSubcommand?.(false) ?? null,
        },
      );
      await this.replyWithFailure(interaction, isPublic);
      return true;
    }
  }

  async rank(interaction) {
    const user = interaction.options.getUser("member") ?? interaction.user;
    const stats = this.store.getMemberStats(interaction.guild.id, user.id);
    const embed = buildRankEmbed({
      user,
      stats,
      guild: interaction.guild,
      clientUser: this.client.user,
    });

    await interaction.editReply({
      embeds: [embed],
      allowedMentions: { parse: [] },
    });
  }

  async leaderboard(interaction) {
    const requestedPage = interaction.options.getInteger("page") ?? 1;
    let page = requestedPage;
    let leaderboard = this.store.getLeaderboard(interaction.guild.id, {
      limit: LEADERBOARD_PAGE_SIZE,
      offset: (page - 1) * LEADERBOARD_PAGE_SIZE,
    });
    const totalPages = Math.max(
      1,
      Math.ceil(leaderboard.total / LEADERBOARD_PAGE_SIZE),
    );

    if (page > totalPages) {
      page = totalPages;
      leaderboard = this.store.getLeaderboard(interaction.guild.id, {
        limit: LEADERBOARD_PAGE_SIZE,
        offset: (page - 1) * LEADERBOARD_PAGE_SIZE,
      });
    }

    const embed = buildLeaderboardEmbed({
      guild: interaction.guild,
      leaderboard,
      page,
      pageSize: LEADERBOARD_PAGE_SIZE,
      clientUser: this.client.user,
    });

    await interaction.editReply({
      embeds: [embed],
      allowedMentions: { parse: [] },
    });
  }

  async rewards(interaction) {
    const rewards = this.store.listRoleRewards(interaction.guild.id);
    const embed = buildRewardsEmbed({
      guild: interaction.guild,
      rewards,
      clientUser: this.client.user,
    });

    await interaction.editReply({
      embeds: [embed],
      allowedMentions: { parse: [] },
    });
  }

  async enable(interaction) {
    const config = this.store.setEnabled(interaction.guild.id, true);
    await interaction.editReply(
      `🩷 XP earning is now **enabled**. Members receive **${config.xpMin}–${config.xpMax} XP** at most once every **${config.cooldownSeconds} seconds**.`,
    );
  }

  async disable(interaction) {
    this.store.setEnabled(interaction.guild.id, false);
    await interaction.editReply(
      "☁️ XP earning is now **disabled**. Existing levels, ranks, and rewards were kept.",
    );
  }

  async configureChannel(interaction) {
    const channel = interaction.options.getChannel("channel", true);
    if (
      !isConfigurableLevelChannel(channel) ||
      channel.guildId !== interaction.guild.id
    ) {
      await interaction.editReply(
        "Please choose a regular text or announcement channel from this server.",
      );
      return;
    }

    const inspection = await inspectLevelChannelObject({
      guild: interaction.guild,
      channel,
      clientUserId: this.client.user.id,
    });
    if (!inspection.valid) {
      const missing = missingChannelPermissions(inspection);
      const detail = missing.length > 0 ? missing.join(", ") : inspection.reason;
      await interaction.editReply(
        `I can’t send level-ups in ${channel} yet. Please fix: **${detail}**.`,
      );
      return;
    }

    this.store.setNotificationChannel(interaction.guild.id, channel.id);
    await interaction.editReply(
      `🎀 Level-up notifications will now be sent in ${channel}.`,
    );
  }

  async resetChannel(interaction) {
    this.store.setNotificationChannel(interaction.guild.id, null);
    await interaction.editReply(
      "🌸 Dedicated notifications were cleared. Level-ups will appear where the member earned the XP.",
    );
  }

  async settings(interaction) {
    const current = this.store.getConfig(interaction.guild.id);
    const cooldownSeconds =
      interaction.options.getInteger("cooldown-seconds") ?? current.cooldownSeconds;
    const xpMin = interaction.options.getInteger("minimum-xp") ?? current.xpMin;
    const xpMax = interaction.options.getInteger("maximum-xp") ?? current.xpMax;

    if (xpMin > xpMax) {
      await interaction.editReply(
        "Minimum XP cannot be greater than maximum XP. Please adjust those values.",
      );
      return;
    }

    const config = this.store.setSettings(interaction.guild.id, {
      xpMin,
      xpMax,
      cooldownSeconds,
    });

    await interaction.editReply(
      `୨୧ XP settings saved: **${config.xpMin}–${config.xpMax} XP** per eligible message with a **${config.cooldownSeconds}-second cooldown**.`,
    );
  }

  async addRoleReward(interaction) {
    const role = interaction.options.getRole("role", true);
    const requiredLevel = interaction.options.getInteger("level", true);
    const inspection = await inspectRewardRole({
      guild: interaction.guild,
      role,
      actorId: interaction.user.id,
      clientUserId: this.client.user.id,
    });

    if (!inspection.valid) {
      await interaction.editReply(`I can’t use that reward role: **${inspection.reason}**`);
      return;
    }

    this.store.setRoleReward(interaction.guild.id, role.id, requiredLevel);
    await interaction.editReply(
      `✨ ${role} will now unlock automatically at **Level ${requiredLevel}**. Members already above that level receive it after their next XP award.`,
    );
  }

  async removeRoleReward(interaction) {
    const role = interaction.options.getRole("role", true);
    const removed = this.store.removeRoleReward(interaction.guild.id, role.id);
    await interaction.editReply(
      removed
        ? `🫧 ${role} was removed from the level rewards. Existing members keep the role.`
        : `${role} was not configured as a level reward.`,
    );
  }

  async testNotification(interaction) {
    const config = this.store.getConfig(interaction.guild.id);
    const stats = this.store.getMemberStats(interaction.guild.id, interaction.user.id);
    const member = await interaction.guild.members.fetch(interaction.user.id);
    const currentLevel = levelFromXp(stats.xp);
    const previewLevel = Math.min(10_000, currentLevel + 1);
    const previewXp = Math.max(stats.xp, totalXpForLevel(previewLevel));
    const destination = await this.resolveNotificationDestination({
      guild: interaction.guild,
      configuredChannelId: config.notificationChannelId,
      fallbackChannel: interaction.channel,
      allowConfiguredFallback: false,
    });

    if (!destination.valid) {
      const missing = missingChannelPermissions(destination);
      const detail = missing.length > 0 ? missing.join(", ") : destination.reason;
      await interaction.editReply(`I couldn’t send the preview: **${detail}**`);
      return;
    }

    const embed = buildLevelUpEmbed({
      member,
      level: previewLevel,
      totalXp: previewXp,
      clientUser: this.client.user,
      preview: true,
    });
    await destination.channel.send({
      embeds: [embed],
      allowedMentions: { parse: [], users: [member.id] },
    });
    await interaction.editReply(
      `🌸 Level-up preview sent successfully in ${destination.channel}.`,
    );
  }

  async status(interaction) {
    const health = this.store.getHealth();
    if (!health.ok) {
      const embed = new EmbedBuilder()
        .setColor(0xe4a067)
        .setTitle("୨୧ Level System Status")
        .setDescription(
          `❌ **Storage unavailable**\n${health.message}\n\nThe welcome system remains unaffected.`,
        )
        .setFooter({ text: "Sofra ♡ Levels" })
        .setTimestamp();
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const config = this.store.getConfig(interaction.guild.id);
    const roleRewards = this.store.listRoleRewards(interaction.guild.id);
    const usesActivityChannel = !config.notificationChannelId;
    const channelInspection = usesActivityChannel
      ? await inspectLevelChannelObject({
          guild: interaction.guild,
          channel: interaction.channel,
          clientUserId: this.client.user.id,
        })
      : await inspectLevelChannel({
          guild: interaction.guild,
          channelId: config.notificationChannelId,
          clientUserId: this.client.user.id,
        });
    const manageRoles = Boolean(
      interaction.guild.members.me?.permissions.has(PermissionFlagsBits.ManageRoles),
    );
    const roleConfigurationValid = roleRewards.length === 0 || manageRoles;
    const valid = health.ok && channelInspection.valid && roleConfigurationValid;
    const channelValue = usesActivityChannel
      ? "Same channel where XP is earned"
      : channelInspection.channel
        ? `<#${config.notificationChannelId}>`
        : `Missing channel (${config.notificationChannelId})`;

    const embed = new EmbedBuilder()
      .setColor(valid ? LEVEL_COLORS[1] : 0xe4a067)
      .setAuthor({
        name: "♡ Sofra Level Settings",
        iconURL: this.client.user.displayAvatarURL({ extension: "png", size: 128 }),
      })
      .setTitle("୨୧ Level System Status")
      .addFields(
        {
          name: "🎀 XP Earning",
          value: config.enabled ? "✅ Enabled" : "⏸️ Disabled",
          inline: true,
        },
        {
          name: "🌸 XP Range",
          value: `${config.xpMin}–${config.xpMax} XP`,
          inline: true,
        },
        {
          name: "⏳ Cooldown",
          value: `${config.cooldownSeconds} seconds`,
          inline: true,
        },
        { name: "☁️ Notification Channel", value: channelValue, inline: false },
        {
          name: "👁️ View Channel",
          value: yesOrNo(channelInspection.viewChannel),
          inline: true,
        },
        {
          name: "💌 Send Messages",
          value: yesOrNo(channelInspection.sendMessages),
          inline: true,
        },
        {
          name: "✨ Embed Links",
          value: yesOrNo(channelInspection.embedLinks),
          inline: true,
        },
        {
          name: "🎭 Manage Roles",
          value: `${yesOrNo(manageRoles)} • ${roleRewards.length} configured reward(s)`,
          inline: false,
        },
        {
          name: "🫧 Database",
          value: `${yesOrNo(health.ok)} — ${health.message}`,
          inline: false,
        },
        {
          name: "✦ Configuration Valid",
          value: yesOrNo(valid),
          inline: false,
        },
      )
      .setFooter({
        text: usesActivityChannel
          ? "Activity-channel permissions are checked again for every level-up ♡"
          : "Sofra ♡ Levels",
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }

  async handleMessage(message) {
    if (
      !message.inGuild() ||
      message.author.bot ||
      message.webhookId ||
      message.system ||
      !this.store.getHealth().ok
    ) {
      return;
    }

    const now = Date.now();
    this.pruneProcessedMessages(now);
    if (this.processedMessages.has(message.id)) {
      return;
    }
    this.processedMessages.set(message.id, now);

    try {
      const config = this.store.getConfig(message.guild.id);
      if (!config.enabled) {
        return;
      }

      const xp = randomInt(config.xpMin, config.xpMax + 1);
      const award = this.store.awardMessageXp({
        guildId: message.guild.id,
        userId: message.author.id,
        messageId: message.id,
        now: Math.max(0, Math.trunc(message.createdTimestamp || now)),
        xp,
      });

      if (!award.awarded) {
        return;
      }

      const oldLevel = levelFromXp(award.previousXp);
      const newLevel = levelFromXp(award.newXp);
      let member = message.member;
      if (!member) {
        member = await message.guild.members.fetch(message.author.id);
      }

      const roleRewards = this.store.listRoleRewards(message.guild.id);
      const assignedRoles = await grantEligibleRoleRewards({
        member,
        rewards: roleRewards,
        level: newLevel,
        logger: this.logger,
      });

      if (newLevel > oldLevel) {
        await this.sendLevelUpNotification({
          member,
          newLevel,
          totalXp: award.newXp,
          assignedRoles,
          config,
          sourceChannel: message.channel,
        });
      }
    } catch (error) {
      this.logger.error(
        "LEVEL_MESSAGE_FAILED",
        "An XP event failed without affecting the Discord client or welcome system.",
        error,
        {
          guildId: message.guildId,
          channelId: message.channelId,
          memberId: message.author.id,
          messageId: message.id,
        },
      );
    }
  }

  async sendLevelUpNotification({
    member,
    newLevel,
    totalXp,
    assignedRoles,
    config,
    sourceChannel,
  }) {
    const destination = await this.resolveNotificationDestination({
      guild: member.guild,
      configuredChannelId: config.notificationChannelId,
      fallbackChannel: sourceChannel,
      allowConfiguredFallback: true,
    });

    if (!destination.valid) {
      this.logger.warn(
        "LEVEL_NOTIFICATION_SKIPPED",
        "A member leveled up, but no usable notification channel was available.",
        {
          guildId: member.guild.id,
          memberId: member.id,
          configuredChannelId: config.notificationChannelId,
          sourceChannelId: sourceChannel?.id,
          reason: destination.reason,
        },
      );
      return;
    }

    const embed = buildLevelUpEmbed({
      member,
      level: newLevel,
      totalXp,
      assignedRoles,
      clientUser: this.client.user,
    });

    try {
      await destination.channel.send({
        embeds: [embed],
        allowedMentions: { parse: [], users: [member.id] },
      });
    } catch (error) {
      this.logger.error(
        "LEVEL_NOTIFICATION_FAILED",
        "Discord rejected a level-up notification.",
        error,
        {
          guildId: member.guild.id,
          memberId: member.id,
          channelId: destination.channel.id,
          level: newLevel,
        },
      );
    }
  }

  async resolveNotificationDestination({
    guild,
    configuredChannelId,
    fallbackChannel,
    allowConfiguredFallback,
  }) {
    if (configuredChannelId) {
      const configured = await inspectLevelChannel({
        guild,
        channelId: configuredChannelId,
        clientUserId: this.client.user.id,
      });
      if (configured.valid || !allowConfiguredFallback) {
        return configured;
      }

      this.logger.warn(
        "LEVEL_NOTIFICATION_FALLBACK",
        "The configured level-up channel is invalid; trying the activity channel.",
        { guildId: guild.id, channelId: configuredChannelId, reason: configured.reason },
      );
    }

    return inspectLevelChannelObject({
      guild,
      channel: fallbackChannel,
      clientUserId: this.client.user.id,
    });
  }

  handleRoleDelete(role) {
    if (!this.store.getHealth().ok) {
      return;
    }

    try {
      const removed = this.store.removeRoleReward(role.guild.id, role.id);
      if (removed) {
        this.logger.info(
          "LEVEL_ROLE_REWARD_REMOVED",
          "A deleted Discord role was removed from level rewards.",
          { guildId: role.guild.id, roleId: role.id },
        );
      }
    } catch (error) {
      this.logger.error(
        "LEVEL_ROLE_DELETE_CLEANUP_FAILED",
        "A deleted role could not be removed from level configuration.",
        error,
        { guildId: role.guild.id, roleId: role.id },
      );
    }
  }

  pruneProcessedMessages(now) {
    if (this.processedMessages.size < MAX_PROCESSED_MESSAGES) {
      return;
    }

    for (const [messageId, timestamp] of this.processedMessages) {
      if (now - timestamp >= PROCESSED_MESSAGE_TTL_MS) {
        this.processedMessages.delete(messageId);
      }
    }

    while (this.processedMessages.size >= MAX_PROCESSED_MESSAGES) {
      const oldestMessageId = this.processedMessages.keys().next().value;
      this.processedMessages.delete(oldestMessageId);
    }
  }

  async replyWithFailure(interaction, isPublic) {
    const content =
      "Sofra couldn’t complete that level action. No XP was duplicated—please check `/level status` and the Wispbyte console.";

    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content, embeds: [] });
      } else if (isPublic) {
        await interaction.reply({ content });
      } else {
        await interaction.reply({
          content,
          flags: MessageFlags.Ephemeral,
        });
      }
    } catch (replyError) {
      this.logger.error(
        "LEVEL_COMMAND_REPLY_FAILED",
        "Discord would not accept the level command's error response.",
        replyError,
        { guildId: interaction.guildId, userId: interaction.user?.id },
      );
    }
  }
}
