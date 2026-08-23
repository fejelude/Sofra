import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

export const autoRoleCommand = new SlashCommandBuilder()
  .setName("autorole")
  .setDescription("Configure Sofra's automatic role for new members.")
  .setDMPermission(false)
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((subcommand) =>
    subcommand
      .setName("role")
      .setDescription("Choose the role given to new members.")
      .addRoleOption((option) =>
        option
          .setName("role")
          .setDescription("The role Sofra should give to new members.")
          .setRequired(true),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand.setName("enable").setDescription("Turn automatic role assignment on."),
  )
  .addSubcommand((subcommand) =>
    subcommand.setName("disable").setDescription("Turn automatic role assignment off."),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("test")
      .setDescription("Test the configured role using your own member account."),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("status")
      .setDescription("Check the configured role, permissions, hierarchy, and storage."),
  );
