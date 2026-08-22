import {
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
} from "discord.js";
import { buildWelcomeEmbed, SOFRA_COLORS } from "./embed.js";
import {
  inspectWelcomeChannel,
  isSupportedWelcomeChannel,
} from "./permissions.js";

const DUPLICATE_WINDOW_MS = 60_000;
const MAX_RECENT_WELCOMES = 1_000;

function yesOrNo(value) {
  return value ? "✅ Yes" : "❌ No";
}

function missingPermissions(inspection) {
  const missing = [];
  if (!inspection.viewChannel) missing.push("View Channel");
  if (!inspection.sendMessages) missing.push("Send Messages");
  if (!inspection.embedLinks) missing.push("Embed Links");
  return missing;
}

function statusChannelValue(channelId, inspection) {
  if (!channelId) {
    return "Not configured";
  }

  if (!inspection.channel) {
    return `Missing channel (${channelId})`;
  }

  return `<#${channelId}>`;
}

export class WelcomeService {
  constructor({ client, store, logger }) {
    this.client = client;
    this.store = store;
    this.logger = logger;
    this.inFlightWelcomes = new Set();
    this.recentWelcomes = new Map();
  }

  async handleInteraction(interaction) {
    if (!interaction.isChatInputCommand() || interaction.commandName !== "welcome") {
      return false;
    }

    try {
      if (!interaction.inGuild() || !interaction.guild) {
        await interaction.reply({
          content: "୨୧ The welcome system can only be configured inside a server.",
          flags: MessageFlags.Ephemeral,
        });
        return true;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.editReply(
          "You need **Manage Server** permission to configure Sofra’s welcome system.",
        );
        return true;
      }

      const subcommand = interaction.options.getSubcommand(true);

      if (subcommand === "channel") {
        await this.configureChannel(interaction);
      } else if (subcommand === "enable") {
        await this.enable(interaction);
      } else if (subcommand === "disable") {
        await this.disable(interaction);
      } else if (subcommand === "test") {
        await this.test(interaction);
      } else if (subcommand === "status") {
        await this.status(interaction);
      } else {
        await interaction.editReply("That welcome subcommand is not supported.");
      }

      return true;
    } catch (error) {
      this.logger.error(
        "WELCOME_COMMAND_FAILED",
        "A /welcome command failed without affecting the rest of the bot.",
        error,
        {
          guildId: interaction.guildId,
          userId: interaction.user?.id,
          subcommand: interaction.options?.getSubcommand?.(false) ?? null,
        },
      );

      await this.replyWithFailure(interaction);
      return true;
    }
  }

  async configureChannel(interaction) {
    const channel = interaction.options.getChannel("channel", true);

    if (
      !isSupportedWelcomeChannel(channel) ||
      channel.guildId !== interaction.guild.id
    ) {
      await interaction.editReply(
        "Please choose a regular text or announcement channel from this server.",
      );
      return;
    }

    const inspection = await this.inspect(interaction.guild, channel.id);
    if (!inspection.valid) {
      const missing = missingPermissions(inspection);
      const detail = missing.length > 0 ? missing.join(", ") : inspection.reason;
      await interaction.editReply(
        `I can’t use ${channel} yet. Please fix: **${detail}**, then run the command again.`,
      );
      return;
    }

    await this.store.setChannel(interaction.guild.id, channel.id);
    await interaction.editReply(
      `🎀 Welcome channel saved as ${channel}. Sofra can view it, send messages, and send embeds there.`,
    );
  }

  async enable(interaction) {
    const config = this.store.getGuildConfig(interaction.guild.id);
    const inspection = await this.inspect(interaction.guild, config.channelId);

    if (!inspection.valid) {
      const missing = missingPermissions(inspection);
      const detail = missing.length > 0 ? missing.join(", ") : inspection.reason;
      await interaction.editReply(
        `I can’t enable welcomes yet: **${detail}** Use \`/welcome channel\` or fix the channel permissions first.`,
      );
      return;
    }

    await this.store.setEnabled(interaction.guild.id, true);
    await interaction.editReply(
      `🩷 Welcome messages are now **enabled** in <#${config.channelId}>.`,
    );
  }

  async disable(interaction) {
    await this.store.setEnabled(interaction.guild.id, false);
    await interaction.editReply(
      "☁️ Welcome messages are now **disabled**. Your saved channel was kept.",
    );
  }

  async test(interaction) {
    const config = this.store.getGuildConfig(interaction.guild.id);
    const inspection = await this.inspect(interaction.guild, config.channelId);

    if (!inspection.valid) {
      const missing = missingPermissions(inspection);
      const detail = missing.length > 0 ? missing.join(", ") : inspection.reason;
      await interaction.editReply(`I couldn’t send a preview: **${detail}**`);
      return;
    }

    const member = await interaction.guild.members.fetch(interaction.user.id);
    await this.sendWelcome(member, inspection.channel);

    const disabledNote = config.enabled
      ? ""
      : " The live welcome system is still disabled; this was only a preview.";
    await interaction.editReply(
      `🌸 Preview sent successfully in <#${config.channelId}>.${disabledNote}`,
    );
  }

  async status(interaction) {
    const config = this.store.getGuildConfig(interaction.guild.id);
    const health = this.store.getHealth();
    const inspection = await this.inspect(interaction.guild, config.channelId);
    const valid = health.ok && inspection.valid;
    const validityDetail = health.ok ? inspection.reason : health.message;

    const embed = new EmbedBuilder()
      .setColor(valid ? SOFRA_COLORS[1] : 0xe4a067)
      .setAuthor({
        name: "♡ Sofra Welcome Settings",
        iconURL: this.client.user.displayAvatarURL({ extension: "png", size: 128 }),
      })
      .setTitle("୨୧ Welcome System Status")
      .addFields(
        {
          name: "🎀 System",
          value: config.enabled ? "✅ Enabled" : "⏸️ Disabled",
          inline: true,
        },
        {
          name: "🌸 Channel",
          value: statusChannelValue(config.channelId, inspection),
          inline: true,
        },
        {
          name: "☁️ Channel Exists",
          value: yesOrNo(inspection.exists),
          inline: true,
        },
        {
          name: "👁️ View Channel",
          value: yesOrNo(inspection.viewChannel),
          inline: true,
        },
        {
          name: "💌 Send Messages",
          value: yesOrNo(inspection.sendMessages),
          inline: true,
        },
        {
          name: "✨ Embed Links",
          value: yesOrNo(inspection.embedLinks),
          inline: true,
        },
        {
          name: "✦ Configuration Valid",
          value: `${yesOrNo(valid)} — ${validityDetail}`,
          inline: false,
        },
        {
          name: "🫧 Storage",
          value: `${yesOrNo(health.ok)} — ${health.message}`,
          inline: false,
        },
      )
      .setFooter({ text: "Sofra ♡ Welcome" })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }

  async handleMemberJoin(member) {
    const config = this.store.getGuildConfig(member.guild.id);
    if (!config.enabled) {
      return;
    }

    const key = `${member.guild.id}:${member.id}`;
    const now = Date.now();
    this.pruneRecentWelcomes(now);

    if (
      this.inFlightWelcomes.has(key) ||
      now - (this.recentWelcomes.get(key) ?? 0) < DUPLICATE_WINDOW_MS
    ) {
      return;
    }

    this.inFlightWelcomes.add(key);

    try {
      const inspection = await this.inspect(member.guild, config.channelId);
      if (!inspection.valid) {
        this.logger.warn(
          "WELCOME_SKIPPED_INVALID_CONFIG",
          "A member joined, but the configured welcome channel is not usable.",
          {
            guildId: member.guild.id,
            channelId: config.channelId,
            reason: inspection.reason,
          },
        );
        return;
      }

      await this.sendWelcome(member, inspection.channel);
      this.recentWelcomes.set(key, Date.now());
    } catch (error) {
      this.logger.error(
        "WELCOME_SEND_FAILED",
        "A welcome message could not be sent; Sofra remains online.",
        error,
        {
          guildId: member.guild.id,
          channelId: config.channelId,
          memberId: member.id,
        },
      );
    } finally {
      this.inFlightWelcomes.delete(key);
    }
  }

  inspect(guild, channelId) {
    return inspectWelcomeChannel({
      guild,
      channelId,
      clientUserId: this.client.user.id,
    });
  }

  sendWelcome(member, channel) {
    const embed = buildWelcomeEmbed({ member, clientUser: this.client.user });

    return channel.send({
      embeds: [embed],
      allowedMentions: {
        parse: [],
        users: [member.id],
      },
    });
  }

  pruneRecentWelcomes(now) {
    if (this.recentWelcomes.size < MAX_RECENT_WELCOMES) {
      return;
    }

    for (const [key, timestamp] of this.recentWelcomes) {
      if (now - timestamp >= DUPLICATE_WINDOW_MS) {
        this.recentWelcomes.delete(key);
      }
    }

    while (this.recentWelcomes.size >= MAX_RECENT_WELCOMES) {
      const oldestKey = this.recentWelcomes.keys().next().value;
      this.recentWelcomes.delete(oldestKey);
    }
  }

  async replyWithFailure(interaction) {
    const content =
      "Sofra couldn’t complete that welcome action. Nothing else was affected—please check `/welcome status` and the Wispbyte console.";

    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content, embeds: [] });
      } else {
        await interaction.reply({ content, flags: MessageFlags.Ephemeral });
      }
    } catch (replyError) {
      this.logger.error(
        "WELCOME_COMMAND_REPLY_FAILED",
        "Discord would not accept the welcome command's error response.",
        replyError,
        { guildId: interaction.guildId, userId: interaction.user?.id },
      );
    }
  }
}
