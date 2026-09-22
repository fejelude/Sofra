import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

export const aiCommand = new SlashCommandBuilder()
  .setName("ai")
  .setDescription("Manage Sofra's AI chat channel without a subcommand tree.")
  .setDMPermission(false)
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addStringOption((option) =>
    option
      .setName("action")
      .setDescription("Review, configure, or disable AI chat.")
      .addChoices(
        { name: "Status", value: "status" },
        { name: "Set channel", value: "channel" },
        { name: "Disable", value: "disable" },
      ),
  )
  .addChannelOption((option) =>
    option
      .setName("channel")
      .setDescription("Channel Sofra should answer in when action is Set channel.")
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
  );
