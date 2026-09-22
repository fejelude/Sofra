import { EmbedBuilder, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

export const onboardingCommands = [
  new SlashCommandBuilder().setName("help").setDescription("Find Sofra commands and learn how to get started").setDMPermission(false),
  new SlashCommandBuilder().setName("setup").setDescription("Get a private setup checklist for this server").setDMPermission(false).setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder().setName("health").setDescription("Check Sofra permissions, storage, and configuration sync").setDMPermission(false).setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
];

export class OnboardingService {
  constructor({ client, store, sharedConfig, logger, websiteUrl }) {
    Object.assign(this, { client, store, sharedConfig, logger, websiteUrl });
  }

  async handleInteraction(interaction) {
    if (!interaction.isChatInputCommand() || !["help", "setup", "health"].includes(interaction.commandName)) return false;
    if (!interaction.inGuild()) {
      await interaction.reply({ content: "Use this command in a server with Sofra installed.", flags: MessageFlags.Ephemeral });
      return true;
    }
    const admin = interaction.guild.ownerId === interaction.user.id || interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
    if (interaction.commandName !== "help" && !admin) {
      await interaction.reply({ content: "You need Manage Server to view server setup and health.", flags: MessageFlags.Ephemeral });
      return true;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const embed = new EmbedBuilder().setColor(0xf4a7c2).setFooter({ text: "Sofra • Your server, your settings" });
    if (interaction.commandName === "help") {
      embed.setTitle("A little help from Sofra ♡").setDescription("Type `/` and select Sofra to see commands available to you.")
        .addFields(
          { name: "Community", value: "`/level rank` · `/level leaderboard` · `/userinfo` · `/serverinfo` · `/meme`" },
          { name: "Staff tools", value: "Moderation commands follow Discord permissions. Use `/automod status` to review filtering and `/modlog status` for private logs." },
          { name: "Server managers", value: "Start with `/setup`. Configure `/welcome`, `/level`, `/autorole`, `/booster`, and `/automod`. Check `/health` when something is not working." },
        );
    } else if (interaction.commandName === "setup") {
      embed.setTitle("Make Sofra at home").setDescription("Each server is independent. Start small; enable only the modules you need.")
        .addFields(
          { name: "1 · Check permissions", value: "Run `/health`. Move Sofra above roles she should assign, but below trusted staff. Administrator is not required." },
          { name: "2 · Welcome your members", value: "Choose `/welcome channel`, then `/welcome test` and `/welcome enable`. Add an optional `/autorole role`." },
          { name: "3 · Keep staff informed", value: "Use `/modlog setup` to create private staff logs. Configure `/automod`, test rules privately with `/automod test`, then enable it." },
          { name: "4 · Make it yours", value: "Enable levels, configure tickets in the dashboard, and choose booster celebrations. These settings affect this server only." },
        );
    } else {
      const me = interaction.guild.members.me ?? await interaction.guild.members.fetchMe();
      const permissions = [
        ["Send Messages", PermissionFlagsBits.SendMessages], ["Embed Links", PermissionFlagsBits.EmbedLinks],
        ["Manage Roles", PermissionFlagsBits.ManageRoles], ["Manage Messages", PermissionFlagsBits.ManageMessages],
        ["Moderate Members", PermissionFlagsBits.ModerateMembers], ["View Audit Log", PermissionFlagsBits.ViewAuditLog],
      ];
      embed.setTitle("Sofra health check").setDescription("Server-level checks; individual channel overwrites and role hierarchy can still restrict an action.")
        .addFields(
          { name: "Local storage", value: this.store.getHealth().ok ? "Available" : "Unavailable — contact the bot operator" },
          { name: "Dashboard sync", value: this.sharedConfig.enabled ? "Configured; see the dashboard for the last successful sync." : "Not configured — Discord settings work locally." },
          { name: "Permissions", value: permissions.map(([name, flag]) => `${me.permissions.has(flag) ? "✓" : "—"} ${name}`).join("\n") },
          { name: "Gateway latency", value: `${Math.max(0, Math.round(this.client.ws.ping))} ms` },
        );
    }
    if (this.websiteUrl) embed.addFields({ name: "Dashboard & guides", value: `[Open Sofra](${this.websiteUrl}/sofra)` });
    await interaction.editReply({ embeds: [embed], allowedMentions: { parse: [] } });
    return true;
  }
}
