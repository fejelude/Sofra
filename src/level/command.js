import { ChannelType, SlashCommandBuilder } from "discord.js";

export const levelCommand = new SlashCommandBuilder()
  .setName("level")
  .setDescription("View ranks or configure Sofra's level system.")
  .setDMPermission(false)
  .addSubcommand((subcommand) =>
    subcommand
      .setName("rank")
      .setDescription("View your rank or another member's rank.")
      .addUserOption((option) =>
        option
          .setName("member")
          .setDescription("The member whose rank you want to view."),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("leaderboard")
      .setDescription("View the server XP leaderboard.")
      .addIntegerOption((option) =>
        option
          .setName("page")
          .setDescription("Leaderboard page number.")
          .setMinValue(1)
          .setMaxValue(100),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("rewards")
      .setDescription("View the automatic role rewards for each level."),
  )
  .addSubcommand((subcommand) =>
    subcommand.setName("enable").setDescription("Turn XP earning on."),
  )
  .addSubcommand((subcommand) =>
    subcommand.setName("disable").setDescription("Pause XP earning."),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("channel")
      .setDescription("Set a dedicated channel for level-up notifications.")
      .addChannelOption((option) =>
        option
          .setName("channel")
          .setDescription("The text or announcement channel to use.")
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
          .setRequired(true),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("channel-reset")
      .setDescription("Send level-ups in the channel where XP was earned."),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("settings")
      .setDescription("Adjust Sofra's XP amount and anti-spam cooldown.")
      .addIntegerOption((option) =>
        option
          .setName("cooldown-seconds")
          .setDescription("Seconds before the same member can earn XP again (15–3600).")
          .setMinValue(15)
          .setMaxValue(3_600),
      )
      .addIntegerOption((option) =>
        option
          .setName("minimum-xp")
          .setDescription("Minimum XP awarded per eligible message (1–100).")
          .setMinValue(1)
          .setMaxValue(100),
      )
      .addIntegerOption((option) =>
        option
          .setName("maximum-xp")
          .setDescription("Maximum XP awarded per eligible message (1–100).")
          .setMinValue(1)
          .setMaxValue(100),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("role-add")
      .setDescription("Add or update an automatic role reward.")
      .addIntegerOption((option) =>
        option
          .setName("level")
          .setDescription("The level required to unlock the role.")
          .setMinValue(1)
          .setMaxValue(1_000)
          .setRequired(true),
      )
      .addRoleOption((option) =>
        option
          .setName("role")
          .setDescription("The role Sofra should award.")
          .setRequired(true),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("role-remove")
      .setDescription("Remove an automatic role reward.")
      .addRoleOption((option) =>
        option
          .setName("role")
          .setDescription("The reward role to remove.")
          .setRequired(true),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("test")
      .setDescription("Preview a level-up notification without changing XP."),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("status")
      .setDescription("Check XP settings, notification access, and role permissions."),
  );

export const PUBLIC_LEVEL_SUBCOMMANDS = Object.freeze(
  new Set(["rank", "leaderboard", "rewards"]),
);
