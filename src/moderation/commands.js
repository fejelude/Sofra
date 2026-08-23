import {
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";

function reasonOption(option) {
  return option
    .setName("reason")
    .setDescription("Reason recorded for this action.")
    .setMaxLength(500);
}

function memberOption(option) {
  return option
    .setName("member")
    .setDescription("The server member to moderate.")
    .setRequired(true);
}

function textChannelOption(option) {
  return option
    .setName("channel")
    .setDescription("Text channel; defaults to the current channel.")
    .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement);
}

export const purgeCommand = new SlashCommandBuilder()
  .setName("purge")
  .setDescription("Delete many recent messages from this channel.")
  .setDMPermission(false)
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .addStringOption((option) =>
    option
      .setName("messages")
      .setDescription('Enter a number from 1–100, or "all" (up to 1,000 recent messages).')
      .setMinLength(1)
      .setMaxLength(3)
      .setRequired(true),
  );

export const banCommand = new SlashCommandBuilder()
  .setName("ban")
  .setDescription("Ban a user from the server.")
  .setDMPermission(false)
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
  .addUserOption((option) =>
    option.setName("user").setDescription("The user to ban.").setRequired(true),
  )
  .addStringOption(reasonOption)
  .addIntegerOption((option) =>
    option
      .setName("delete-message-days")
      .setDescription("Delete this many days of the user's messages (0–7).")
      .setMinValue(0)
      .setMaxValue(7),
  );

export const kickCommand = new SlashCommandBuilder()
  .setName("kick")
  .setDescription("Remove a member from the server.")
  .setDMPermission(false)
  .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
  .addUserOption(memberOption)
  .addStringOption(reasonOption);

export const muteCommand = new SlashCommandBuilder()
  .setName("mute")
  .setDescription("Temporarily prevent a member from using text and voice chat.")
  .setDMPermission(false)
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addUserOption(memberOption)
  .addIntegerOption((option) =>
    option
      .setName("duration-minutes")
      .setDescription("Timeout duration in minutes (maximum 28 days).")
      .setMinValue(1)
      .setMaxValue(40_320)
      .setRequired(true),
  )
  .addStringOption(reasonOption);

export const unmuteCommand = new SlashCommandBuilder()
  .setName("unmute")
  .setDescription("End a member's Discord timeout early.")
  .setDMPermission(false)
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addUserOption(memberOption)
  .addStringOption(reasonOption);

export const warnCommand = new SlashCommandBuilder()
  .setName("warn")
  .setDescription("Record an official warning and privately notify the member.")
  .setDMPermission(false)
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addUserOption(memberOption)
  .addStringOption((option) => reasonOption(option).setRequired(true));

export const warningsCommand = new SlashCommandBuilder()
  .setName("warnings")
  .setDescription("Privately review a member's recorded warnings.")
  .setDMPermission(false)
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addUserOption(memberOption);

export const unbanCommand = new SlashCommandBuilder()
  .setName("unban")
  .setDescription("Unban a user using their Discord user ID.")
  .setDMPermission(false)
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
  .addStringOption((option) =>
    option
      .setName("user-id")
      .setDescription("The 17–20 digit Discord user ID to unban.")
      .setMinLength(17)
      .setMaxLength(20)
      .setRequired(true),
  )
  .addStringOption(reasonOption);

export const lockdownCommand = new SlashCommandBuilder()
  .setName("lockdown")
  .setDescription("Stop normal members from typing in a text channel.")
  .setDMPermission(false)
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addChannelOption(textChannelOption)
  .addStringOption(reasonOption);

export const unlockCommand = new SlashCommandBuilder()
  .setName("unlock")
  .setDescription("Restore the channel's pre-lockdown typing permission.")
  .setDMPermission(false)
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addChannelOption(textChannelOption)
  .addStringOption(reasonOption);

export const slowmodeCommand = new SlashCommandBuilder()
  .setName("slowmode")
  .setDescription("Set a message cooldown for a text channel.")
  .setDMPermission(false)
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addIntegerOption((option) =>
    option
      .setName("seconds")
      .setDescription("Cooldown in seconds; use 0 to disable (maximum 6 hours).")
      .setMinValue(0)
      .setMaxValue(21_600)
      .setRequired(true),
  )
  .addChannelOption(textChannelOption)
  .addStringOption(reasonOption);

export const moderationCommands = Object.freeze([
  purgeCommand,
  banCommand,
  kickCommand,
  muteCommand,
  warnCommand,
  warningsCommand,
  unbanCommand,
  unmuteCommand,
  lockdownCommand,
  unlockCommand,
  slowmodeCommand,
]);
