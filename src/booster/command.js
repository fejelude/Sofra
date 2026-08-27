import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

export const boosterCommand = new SlashCommandBuilder()
  .setName("booster")
  .setDescription("Configure Sofra's booster role and thank-you embeds.")
  .setDMPermission(false)
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((subcommand) =>
    subcommand
      .setName("setup")
      .setDescription("Choose the booster role and public thank-you channel.")
      .addRoleOption((option) =>
        option
          .setName("role")
          .setDescription("The custom Server Booster role Sofra should assign.")
          .setRequired(true),
      )
      .addChannelOption((option) =>
        option
          .setName("channel")
          .setDescription("Where Sofra should post booster thank-you embeds.")
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
          .setRequired(true),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand.setName("enable").setDescription("Enable booster assignment and thanks."),
  )
  .addSubcommand((subcommand) =>
    subcommand.setName("disable").setDescription("Pause booster assignment and thanks."),
  )
  .addSubcommand((subcommand) =>
    subcommand.setName("test").setDescription("Send a thank-you preview for yourself."),
  )
  .addSubcommand((subcommand) =>
    subcommand.setName("status").setDescription("Check role, channel, and permissions."),
  );
