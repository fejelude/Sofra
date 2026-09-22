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

export const modCommand = new SlashCommandBuilder()
  .setName("mod")
  .setDescription("Moderate members and channels from one clean command.")
  .setDMPermission(false)
  .addStringOption((option) =>
    option
      .setName("action")
      .setDescription("What you want Sofra to do.")
      .setRequired(true)
      .addChoices(
        { name: "Warn member", value: "warn" },
        { name: "View warnings", value: "warnings" },
        { name: "Timeout member", value: "mute" },
        { name: "Remove timeout", value: "unmute" },
        { name: "Kick member", value: "kick" },
        { name: "Ban user", value: "ban" },
        { name: "Unban user", value: "unban" },
        { name: "Lock channel", value: "lockdown" },
        { name: "Unlock channel", value: "unlock" },
        { name: "Set slowmode", value: "slowmode" },
      ),
  )
  .addUserOption((option) =>
    option
      .setName("target")
      .setDescription("Member or user affected by this action."),
  )
  .addStringOption(reasonOption)
  .addIntegerOption((option) =>
    option
      .setName("duration-minutes")
      .setDescription("Timeout duration in minutes (maximum 28 days).")
      .setMinValue(1)
      .setMaxValue(40_320),
  )
  .addIntegerOption((option) =>
    option
      .setName("delete-message-days")
      .setDescription("For bans: delete this many days of messages (0–7).")
      .setMinValue(0)
      .setMaxValue(7),
  )
  .addStringOption((option) =>
    option
      .setName("user-id")
      .setDescription("For unbans: the 17–20 digit Discord user ID.")
      .setMinLength(17)
      .setMaxLength(20),
  )
  .addChannelOption(textChannelOption)
  .addIntegerOption((option) =>
    option
      .setName("seconds")
      .setDescription("For slowmode: seconds between messages; 0 disables it.")
      .setMinValue(0)
      .setMaxValue(21_600),
  );

export const moderationCommands = Object.freeze([
  purgeCommand,
  modCommand,
]);
