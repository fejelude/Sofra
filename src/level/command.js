import { SlashCommandBuilder } from "discord.js";

export const levelCommand = new SlashCommandBuilder()
  .setName("level")
  .setDescription("View your rank and open Sofra's level views.")
  .setDMPermission(false)
  .addUserOption((option) =>
    option
      .setName("member")
      .setDescription("Member whose rank you want to view; defaults to you."),
  );
