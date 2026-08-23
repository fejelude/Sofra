import { EmbedBuilder, MessageFlags, PermissionFlagsBits } from "discord.js";
import { fetchConfiguredRole, inspectAutoRole } from "./role.js";

const SOFRA_PINK = 0xf4a7c2;

function yesOrNo(value) {
  return value ? "✅ Yes" : "❌ No";
}

export class AutoRoleService {
  constructor({ client, store, logger }) {
    this.client = client;
    this.store = store;
    this.logger = logger;
    this.inFlightMembers = new Set();
  }

  async handleInteraction(interaction) {
    if (!interaction.isChatInputCommand() || interaction.commandName !== "autorole") {
      return false;
    }

    try {
      if (!interaction.inGuild() || !interaction.guild) {
        await interaction.reply({
          content: "୨୧ Auto-role can only be configured inside a server.",
          flags: MessageFlags.Ephemeral,
        });
        return true;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.editReply(
          "You need **Manage Server** permission to configure Sofra’s auto-role.",
        );
        return true;
      }

      const subcommand = interaction.options.getSubcommand(true);
      if (subcommand === "role") {
        await this.configureRole(interaction);
      } else if (subcommand === "enable") {
        await this.enable(interaction);
      } else if (subcommand === "disable") {
        await this.disable(interaction);
      } else if (subcommand === "test") {
        await this.test(interaction);
      } else if (subcommand === "status") {
        await this.status(interaction);
      } else {
        await interaction.editReply("That auto-role subcommand is not supported.");
      }

      return true;
    } catch (error) {
      this.logger.error(
        "AUTOROLE_COMMAND_FAILED",
        "An /autorole command failed without affecting Sofra’s other features.",
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

  async configureRole(interaction) {
    const role = interaction.options.getRole("role", true);
    const inspection = await inspectAutoRole({
      guild: interaction.guild,
      role,
      clientUserId: this.client.user.id,
      actorId: interaction.user.id,
    });

    if (!inspection.valid) {
      await interaction.editReply(`I can’t use that role: **${inspection.reason}**`);
      return;
    }

    this.store.setAutoRole(interaction.guild.id, role.id);
    await interaction.editReply(
      `🎀 Auto-role saved as ${role}. Run \`/autorole enable\` when you’re ready.`,
    );
  }

  async enable(interaction) {
    const config = this.store.getAutoRoleConfig(interaction.guild.id);
    const role = await fetchConfiguredRole(interaction.guild, config.roleId);
    const inspection = await inspectAutoRole({
      guild: interaction.guild,
      role,
      clientUserId: this.client.user.id,
      actorId: interaction.user.id,
    });

    if (!inspection.valid) {
      await interaction.editReply(
        `I can’t enable auto-role yet: **${inspection.reason}** Use \`/autorole role\` or fix the permissions first.`,
      );
      return;
    }

    this.store.setAutoRoleEnabled(interaction.guild.id, true);
    await interaction.editReply(
      `🩷 Auto-role is now **enabled**. New members will receive ${role}.`,
    );
  }

  async disable(interaction) {
    this.store.setAutoRoleEnabled(interaction.guild.id, false);
    await interaction.editReply(
      "☁️ Auto-role is now **disabled**. The configured role was kept.",
    );
  }

  async test(interaction) {
    const config = this.store.getAutoRoleConfig(interaction.guild.id);
    const role = await fetchConfiguredRole(interaction.guild, config.roleId);
    const inspection = await inspectAutoRole({
      guild: interaction.guild,
      role,
      clientUserId: this.client.user.id,
      actorId: interaction.user.id,
    });

    if (!inspection.valid) {
      await interaction.editReply(`I couldn’t test auto-role: **${inspection.reason}**`);
      return;
    }

    const member = await interaction.guild.members.fetch(interaction.user.id);
    if (member.roles.cache.has(role.id)) {
      await interaction.editReply(
        `🌸 Test successful— you already have ${role}, and Sofra can manage it.`,
      );
      return;
    }

    await member.roles.add(role, "Sofra auto-role configuration test");
    await interaction.editReply(
      `🌸 Test successful—${role} was assigned to you. This test does not change whether auto-role is enabled.`,
    );
  }

  async status(interaction) {
    const health = this.store.getHealth();
    const config = health.ok
      ? this.store.getAutoRoleConfig(interaction.guild.id)
      : { enabled: false, roleId: null };
    const role = await fetchConfiguredRole(interaction.guild, config.roleId);
    const inspection = await inspectAutoRole({
      guild: interaction.guild,
      role,
      clientUserId: this.client.user.id,
    });
    const valid = health.ok && inspection.valid;

    const embed = new EmbedBuilder()
      .setColor(valid ? SOFRA_PINK : 0xe4a067)
      .setAuthor({
        name: "♡ Sofra Auto-Role Settings",
        iconURL: this.client.user.displayAvatarURL({ extension: "png", size: 128 }),
      })
      .setTitle("୨୧ Auto-Role Status")
      .addFields(
        {
          name: "🎀 System",
          value: config.enabled ? "✅ Enabled" : "⏸️ Disabled",
          inline: true,
        },
        {
          name: "🌸 Configured Role",
          value: role
            ? `<@&${role.id}>`
            : config.roleId
              ? `Missing role (${config.roleId})`
              : "Not configured",
          inline: true,
        },
        { name: "☁️ Role Exists", value: yesOrNo(inspection.exists), inline: true },
        { name: "🛡️ Manage Roles", value: yesOrNo(inspection.manageRoles), inline: true },
        {
          name: "✨ Sofra Above Role",
          value: yesOrNo(inspection.botAboveRole),
          inline: true,
        },
        {
          name: "✦ Configuration Valid",
          value: `${yesOrNo(valid)} — ${health.ok ? inspection.reason : health.message}`,
          inline: false,
        },
        {
          name: "🫧 Storage",
          value: `${yesOrNo(health.ok)} — ${health.message}`,
          inline: false,
        },
      )
      .setFooter({ text: "Sofra ♡ Auto-Role" })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed], allowedMentions: { parse: [] } });
  }

  async handleMemberJoin(member) {
    if (!this.store.getHealth().ok || member.user.bot) {
      return;
    }

    const key = `${member.guild.id}:${member.id}`;
    if (this.inFlightMembers.has(key)) {
      return;
    }

    this.inFlightMembers.add(key);
    try {
      const config = this.store.getAutoRoleConfig(member.guild.id);
      if (!config.enabled || !config.roleId || member.roles.cache.has(config.roleId)) {
        return;
      }

      const role = await fetchConfiguredRole(member.guild, config.roleId);
      const inspection = await inspectAutoRole({
        guild: member.guild,
        role,
        clientUserId: this.client.user.id,
      });
      if (!inspection.valid) {
        this.logger.warn(
          "AUTOROLE_SKIPPED_INVALID_CONFIG",
          "A new member could not receive auto-role because the configuration is invalid.",
          {
            guildId: member.guild.id,
            memberId: member.id,
            roleId: config.roleId,
            reason: inspection.reason,
          },
        );
        return;
      }

      await member.roles.add(role, "Sofra automatic role for a new member");
      this.logger.info(
        "AUTOROLE_ASSIGNED",
        "The configured auto-role was assigned to a new member.",
        { guildId: member.guild.id, memberId: member.id, roleId: role.id },
      );
    } catch (error) {
      this.logger.error(
        "AUTOROLE_ASSIGN_FAILED",
        "A new-member role assignment failed without affecting Sofra’s other features.",
        error,
        { guildId: member.guild.id, memberId: member.id },
      );
    } finally {
      this.inFlightMembers.delete(key);
    }
  }

  handleRoleDelete(role) {
    if (!this.store.getHealth().ok) {
      return;
    }

    try {
      const config = this.store.getAutoRoleConfig(role.guild.id);
      if (config.roleId !== role.id) {
        return;
      }

      this.store.clearAutoRole(role.guild.id);
      this.logger.warn(
        "AUTOROLE_CONFIG_CLEARED",
        "The configured auto-role was deleted, so auto-role was disabled.",
        { guildId: role.guild.id, roleId: role.id },
      );
    } catch (error) {
      this.logger.error(
        "AUTOROLE_ROLE_DELETE_CLEANUP_FAILED",
        "A deleted auto-role could not be cleared from configuration.",
        error,
        { guildId: role.guild.id, roleId: role.id },
      );
    }
  }

  async replyWithFailure(interaction) {
    const content =
      "Sofra couldn’t complete that auto-role action. Please check `/autorole status` and the Wispbyte console.";
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(content);
      } else {
        await interaction.reply({ content, flags: MessageFlags.Ephemeral });
      }
    } catch (replyError) {
      this.logger.error(
        "AUTOROLE_COMMAND_REPLY_FAILED",
        "Discord would not accept the auto-role error response.",
        replyError,
        { guildId: interaction.guildId, userId: interaction.user?.id },
      );
    }
  }
}
