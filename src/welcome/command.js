import {
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";

export const welcomeCommand = new SlashCommandBuilder()
  .setName("welcome")
  .setDescription("Configure Sofra's welcome system.")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setDMPermission(false)
  .addSubcommand((subcommand) =>
    subcommand
      .setName("channel")
      .setDescription("Choose the channel where Sofra welcomes new members.")
      .addChannelOption((option) =>
        option
          .setName("channel")
          .setDescription("The text or announcement channel to use.")
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
          .setRequired(true),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand.setName("enable").setDescription("Turn welcome messages on."),
  )
  .addSubcommand((subcommand) =>
    subcommand.setName("disable").setDescription("Turn welcome messages off."),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("test")
      .setDescription("Send a preview using your member profile."),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("status")
      .setDescription("Check the welcome configuration and channel permissions."),
  );
