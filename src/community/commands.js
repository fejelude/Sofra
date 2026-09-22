import {
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";

export const infoCommand = new SlashCommandBuilder()
  .setName("info")
  .setDescription("Show server information or inspect a member.")
  .setDMPermission(false)
  .addStringOption((option) =>
    option
      .setName("view")
      .setDescription("Choose server or member information.")
      .addChoices(
        { name: "Server", value: "server" },
        { name: "Member", value: "member" },
      ),
  )
  .addUserOption((option) =>
    option
      .setName("member")
      .setDescription("Member to inspect when using the Member view."),
  );

export const embedCommand = new SlashCommandBuilder()
  .setName("embed")
  .setDescription("Open Sofra's announcement embed builder.")
  .setDMPermission(false)
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .addChannelOption((option) =>
    option
      .setName("channel")
      .setDescription("Destination; defaults to the current channel.")
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
  );

export const pollCommand = new SlashCommandBuilder()
  .setName("poll")
  .setDescription("Create a Discord-native poll with clickable choices.")
  .setDMPermission(false)
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .addStringOption((option) =>
    option
      .setName("question")
      .setDescription("The poll question.")
      .setMaxLength(300)
      .setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName("option-1")
      .setDescription("First answer.")
      .setMaxLength(55)
      .setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName("option-2")
      .setDescription("Second answer.")
      .setMaxLength(55)
      .setRequired(true),
  )
  .addStringOption((option) =>
    option.setName("option-3").setDescription("Third answer.").setMaxLength(55),
  )
  .addStringOption((option) =>
    option.setName("option-4").setDescription("Fourth answer.").setMaxLength(55),
  )
  .addStringOption((option) =>
    option.setName("option-5").setDescription("Fifth answer.").setMaxLength(55),
  )
  .addIntegerOption((option) =>
    option
      .setName("duration-hours")
      .setDescription("How long voting stays open; defaults to 24 hours.")
      .addChoices(
        { name: "1 hour", value: 1 },
        { name: "4 hours", value: 4 },
        { name: "8 hours", value: 8 },
        { name: "24 hours", value: 24 },
        { name: "3 days", value: 72 },
        { name: "7 days", value: 168 },
      ),
  );

export const memeCommand = new SlashCommandBuilder()
  .setName("meme")
  .setDescription("Fetch a random safe-for-work meme.")
  .setDMPermission(false);

export const communityCommands = Object.freeze([
  infoCommand,
  embedCommand,
  pollCommand,
  memeCommand,
]);
