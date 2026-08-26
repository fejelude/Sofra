import {
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";

export const ticketChannelCommand = new SlashCommandBuilder()
  .setName("ticket-channel")
  .setDescription("Configure and post Sofra's private support ticket panel.")
  .setDMPermission(false)
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addChannelOption((option) =>
    option
      .setName("panel-channel")
      .setDescription("Channel where Sofra will post the ticket panel.")
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(true),
  )
  .addChannelOption((option) =>
    option
      .setName("ticket-category")
      .setDescription("Category where new private ticket channels will be created.")
      .addChannelTypes(ChannelType.GuildCategory)
      .setRequired(true),
  )
  .addRoleOption((option) =>
    option
      .setName("staff-role")
      .setDescription("Primary staff/moderator role that can access tickets.")
      .setRequired(true),
  )
  .addRoleOption((option) =>
    option.setName("staff-role-2").setDescription("Optional additional ticket staff role."),
  )
  .addRoleOption((option) =>
    option.setName("staff-role-3").setDescription("Optional additional ticket staff role."),
  )
  .addRoleOption((option) =>
    option.setName("staff-role-4").setDescription("Optional additional ticket staff role."),
  )
  .addRoleOption((option) =>
    option.setName("staff-role-5").setDescription("Optional additional ticket staff role."),
  )
  .addChannelOption((option) =>
    option
      .setName("staff-logs")
      .setDescription("Optional: update the existing moderation Staff Logs destination too.")
      .addChannelTypes(ChannelType.GuildText),
  );
