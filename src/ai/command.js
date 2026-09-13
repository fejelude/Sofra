import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

export const aiCommand = new SlashCommandBuilder()
  .setName("ai")
  .setDescription("Configure Sofra's AI chat channel.")
  .setDMPermission(false)
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((subcommand) =>
    subcommand
      .setName("channel")
      .setDescription("Choose the channel where Sofra will answer AI chat.")
      .addChannelOption((option) =>
        option
          .setName("channel")
          .setDescription("The channel where Sofra should answer messages.")
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
          .setRequired(true),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand.setName("disable").setDescription("Stop Sofra from answering AI chat in this server."),
  )
  .addSubcommand((subcommand) =>
    subcommand.setName("status").setDescription("Show the configured AI chat channel."),
  );
