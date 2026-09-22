import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";

const SOFRA_PINK = 0xf4a7c2;
const CONTROL_PREFIX = "sofra:onboarding:";

export const sofraCommand = new SlashCommandBuilder()
  .setName("sofra")
  .setDescription("Open Sofra's help, setup, and server health center.")
  .setDMPermission(false)
  .addStringOption((option) =>
    option
      .setName("view")
      .setDescription("Jump directly to a Sofra view.")
      .addChoices(
        { name: "Home", value: "home" },
        { name: "Setup", value: "setup" },
        { name: "Health", value: "health" },
      ),
  );

export const onboardingCommands = Object.freeze([sofraCommand]);

function isServerManager(interaction) {
  return (
    interaction.guild?.ownerId === interaction.user?.id ||
    interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
  );
}

export class OnboardingService {
  constructor({ client, store, sharedConfig, logger, websiteUrl }) {
    Object.assign(this, { client, store, sharedConfig, logger, websiteUrl });
  }

  async handleInteraction(interaction) {
    const isCommand =
      interaction.isChatInputCommand?.() && interaction.commandName === "sofra";
    const isControl =
      interaction.isButton?.() && interaction.customId.startsWith(CONTROL_PREFIX);

    if (!isCommand && !isControl) return false;

    if (!interaction.inGuild() || !interaction.guild) {
      await interaction.reply({
        content: "Use Sofra inside a server where the bot is installed.",
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    const view = isControl
      ? interaction.customId.slice(CONTROL_PREFIX.length)
      : interaction.options.getString("view") ?? "home";

    if (["setup", "health"].includes(view) && !isServerManager(interaction)) {
      await interaction.reply({
        content: "You need **Manage Server** to open Sofra setup and health.",
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    if (isControl) {
      await interaction.deferUpdate();
    } else {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }

    const embed = await this.buildView(interaction, view);
    await interaction.editReply({
      embeds: [embed],
      components: this.components(view),
      allowedMentions: { parse: [] },
    });
    return true;
  }

  async buildView(interaction, view) {
    const embed = new EmbedBuilder()
      .setColor(SOFRA_PINK)
      .setFooter({ text: "Sofra • simple on the surface, powerful underneath" });

    if (view === "setup") {
      return embed
        .setTitle("Set up Sofra ♡")
        .setDescription(
          "Start small. Sofra's advanced server configuration lives in the dashboard so Discord stays clean.",
        )
        .addFields(
          {
            name: "1 · Check health",
            value:
              "Open **Health** below to verify Sofra's permissions, storage, and dashboard sync.",
          },
          {
            name: "2 · Configure modules",
            value:
              "Use the dashboard for Welcome, Auto Role, AutoMod, Boosters, Tickets, Levels, AI chat, and staff logs.",
          },
          {
            name: "3 · Use Discord for daily actions",
            value:
              "Use `/mod` for moderation, `/purge` for cleanup, `/level` for ranks, and `/info` for server/member information.",
          },
        );
    }

    if (view === "health") {
      const me = interaction.guild.members.me ?? await interaction.guild.members.fetchMe();
      const permissions = [
        ["Send Messages", PermissionFlagsBits.SendMessages],
        ["Embed Links", PermissionFlagsBits.EmbedLinks],
        ["Manage Roles", PermissionFlagsBits.ManageRoles],
        ["Manage Messages", PermissionFlagsBits.ManageMessages],
        ["Moderate Members", PermissionFlagsBits.ModerateMembers],
        ["View Audit Log", PermissionFlagsBits.ViewAuditLog],
      ];
      const storage = this.store?.getHealth?.();
      const dashboardSync = this.sharedConfig?.enabled
        ? "Configured; check the dashboard for the latest sync state."
        : "Not configured — Discord runtime settings stay local.";

      return embed
        .setTitle("Sofra health check")
        .setDescription(
          "These are server-level checks. Individual channel overwrites and role hierarchy can still restrict an action.",
        )
        .addFields(
          {
            name: "Local storage",
            value: storage?.ok ? "Available" : "Unavailable — contact the bot operator",
          },
          { name: "Dashboard sync", value: dashboardSync },
          {
            name: "Permissions",
            value: permissions
              .map(([name, flag]) => `${me.permissions.has(flag) ? "✓" : "—"} ${name}`)
              .join("\n"),
          },
          {
            name: "Gateway latency",
            value: `${Math.max(0, Math.round(this.client?.ws?.ping ?? 0))} ms`,
          },
        );
    }

    return embed
      .setTitle("Sofra control center ♡")
      .setDescription(
        "Sofra now keeps Discord intentionally small. Use the buttons below for setup and health, and the dashboard for deeper configuration.",
      )
      .addFields(
        {
          name: "Everyday",
          value:
            "`/level` ranks · `/info` server/member info · `/meme` community fun",
        },
        {
          name: "Staff",
          value:
            "`/mod` moderation · `/purge` cleanup · `/poll` polls · `/embed` announcements",
        },
        {
          name: "Server configuration",
          value:
            "Open **Setup** below. Advanced module settings stay out of the slash-command picker.",
        },
      );
  }

  components(view) {
    const navigation = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`${CONTROL_PREFIX}home`)
        .setLabel("Home")
        .setStyle(view === "home" ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setDisabled(view === "home"),
      new ButtonBuilder()
        .setCustomId(`${CONTROL_PREFIX}setup`)
        .setLabel("Setup")
        .setStyle(view === "setup" ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setDisabled(view === "setup"),
      new ButtonBuilder()
        .setCustomId(`${CONTROL_PREFIX}health`)
        .setLabel("Health")
        .setStyle(view === "health" ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setDisabled(view === "health"),
    );

    if (this.websiteUrl) {
      navigation.addComponents(
        new ButtonBuilder()
          .setLabel("Dashboard")
          .setStyle(ButtonStyle.Link)
          .setURL(`${this.websiteUrl.replace(/\/$/, "")}/sofra`),
      );
    }

    return [navigation];
  }
}
