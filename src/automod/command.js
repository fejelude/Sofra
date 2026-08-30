import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

const roleKind = (option) => option.setName("kind").setDescription("What this role is allowed to do.").setRequired(true)
  .addChoices({ name: "Moderation bypass", value: "bypass" }, { name: "Moderation manager", value: "manager" }, { name: "Normal links", value: "link" }, { name: "Discord invites", value: "invite" });

export const automodCommand = new SlashCommandBuilder().setName("automod").setDescription("Configure Sofra's context-aware message filter.").setDMPermission(false)
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((sub) => sub.setName("enable").setDescription("Enable filtering without changing saved settings."))
  .addSubcommand((sub) => sub.setName("disable").setDescription("Pause filtering without deleting settings."))
  .addSubcommand((sub) => sub.setName("status").setDescription("Privately review the current filter configuration."))
  .addSubcommand((sub) => sub.setName("test").setDescription("Privately test text without deleting or logging anything.").addStringOption((o) => o.setName("text").setDescription("Text to scan.").setRequired(true).setMaxLength(1000)))
  .addSubcommand((sub) => sub.setName("settings").setDescription("Set enforcement, cooldown, and escalation behavior.")
    .addStringOption((o) => o.setName("mild-action").setDescription("Tier 3 behavior.").addChoices({ name: "Allow", value: "allow" }, { name: "Warn only", value: "warn" }, { name: "Delete silently", value: "delete" }))
    .addBooleanOption((o) => o.setName("block-links").setDescription("Block normal links unless a link role allows them."))
    .addBooleanOption((o) => o.setName("block-invites").setDescription("Block Discord invites unless an invite role allows them."))
    .addBooleanOption((o) => o.setName("strikes").setDescription("Record tier 1 detections in the existing warning system."))
    .addIntegerOption((o) => o.setName("cooldown").setDescription("Public warning cooldown in seconds (5–600).").setMinValue(5).setMaxValue(600))
    .addIntegerOption((o) => o.setName("threshold").setDescription("Violations within 5 minutes before escalation (2–20).").setMinValue(2).setMaxValue(20))
    .addIntegerOption((o) => o.setName("timeout").setDescription("Escalation timeout minutes; 0 disables (0–1440).").setMinValue(0).setMaxValue(1440)))
  .addSubcommand((sub) => sub.setName("role-add").setDescription("Grant a trusted role an automod capability.").addRoleOption((o) => o.setName("role").setDescription("Trusted role.").setRequired(true)).addStringOption(roleKind))
  .addSubcommand((sub) => sub.setName("role-remove").setDescription("Remove an automod role capability.").addRoleOption((o) => o.setName("role").setDescription("Role to remove.").setRequired(true)).addStringOption(roleKind))
  .addSubcommand((sub) => sub.setName("channel").setDescription("Set or clear a channel/category override.").addChannelOption((o) => o.setName("channel").setDescription("Channel or category to configure.").setRequired(true).addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildCategory)).addStringOption((o) => o.setName("mode").setDescription("Override mode.").setRequired(true).addChoices({ name: "Exempt", value: "exempt" }, { name: "Relaxed (allow tier 3)", value: "relaxed" }, { name: "Server default", value: "default" })))
  .addSubcommand((sub) => sub.setName("word-add").setDescription("Add a private server-specific rule.").addStringOption((o) => o.setName("word").setDescription("Word or phrase.").setRequired(true).setMinLength(2).setMaxLength(50)).addIntegerOption((o) => o.setName("tier").setDescription("Severity tier (1–3).").setRequired(true).setMinValue(1).setMaxValue(3)))
  .addSubcommand((sub) => sub.setName("word-remove").setDescription("Remove a custom blocked or whitelisted word.").addStringOption((o) => o.setName("word").setDescription("Exact saved word.").setRequired(true).setMinLength(2).setMaxLength(50)))
  .addSubcommand((sub) => sub.setName("whitelist").setDescription("Whitelist a false-positive word from built-in rules.").addStringOption((o) => o.setName("word").setDescription("Exact word to allow.").setRequired(true).setMinLength(2).setMaxLength(50)));
