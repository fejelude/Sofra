import {
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";

export const modLogCommand = new SlashCommandBuilder()
  .setName("modlog")
  .setDescription("Configure Sofra's private moderation action log.")
  .setDMPermission(false)
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((subcommand) =>
    subcommand
      .setName("setup")
      .setDescription("Create Moderation › #staff-logs and enable logging."),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("channel")
      .setDescription("Use an existing channel for moderation logs.")
      .addChannelOption((option) =>
        option
          .setName("channel")
          .setDescription("The private staff logging channel.")
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
          .setRequired(true),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand.setName("enable").setDescription("Enable moderation logging."),
  )
  .addSubcommand((subcommand) =>
    subcommand.setName("disable").setDescription("Disable moderation logging."),
  )
  .addSubcommand((subcommand) =>
    subcommand.setName("test").setDescription("Send a preview moderation log."),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("status")
      .setDescription("Show configuration, permissions, and storage health."),
  );
