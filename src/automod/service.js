import { EmbedBuilder, MessageFlags, PermissionFlagsBits, escapeMarkdown } from "discord.js";
import { detectContent, detectLinks } from "./detector.js";
import { CATEGORIES } from "./words.js";
import { defaultCategorySettings } from "./detector.js";

const WARNINGS = Object.freeze({
  1: ["be respectful — hateful language is not allowed here.", "that language is not welcome here. Keep this community safe."],
  2: ["hey 😭 let's not say that here pls", "be nicee 😭 keep it friendly"],
  3: ["tiny language check 🌸 keep it cute in here", "oop—let's keep the chat friendly pls 🫧"],
  link: ["links aren't open here, sorryyy 🌸"], invite: ["server invites aren't allowed here, pls 😭"],
});
const roleIds = (member) => new Set(member?.roles?.cache?.keys?.() ?? []);

export class AutomodService {
  constructor({ client, store, logger, modLogService, random = Math.random, now = Date.now }) { Object.assign(this, { client, store, logger, modLogService, random, now }); this.warningTimes = new Map(); this.violations = new Map(); this.logTimes = new Map(); }
  config(guildId) { return this.store.getAutomodConfig(guildId); }
  hasRole(member, config, kind) { const held = roleIds(member); return config.roles.some((entry) => entry.kind === kind && held.has(entry.roleId)); }
  canManage(interaction, config) { return interaction.guild.ownerId === interaction.user.id || interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) || interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) || this.hasRole(interaction.member, config, "manager"); }

  async handleInteraction(interaction) {
    if (!interaction.isChatInputCommand() || interaction.commandName !== "automod") return false;
    if (!interaction.inGuild()) { await interaction.reply({ content: "୨୧ Automod can only be configured in a server.", flags: MessageFlags.Ephemeral }); return true; }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try { const config = this.config(interaction.guildId); if (!this.canManage(interaction, config)) { await interaction.editReply("Only the server owner, Manage Server users, or configured moderation managers can access this."); return true; } await this.runCommand(interaction, config); }
    catch (error) { this.logger.error("AUTOMOD_COMMAND_FAILED", "An automod configuration command failed safely.", error, { guildId: interaction.guildId }); await interaction.editReply("Sofra couldn't save that setting. Check storage and try again."); }
    return true;
  }

  async runCommand(interaction, config) {
    const sub = interaction.options.getSubcommand(); const id = interaction.guildId;
    if (sub === "enable" || sub === "disable") { this.store.setAutomodConfig(id, { enabled: sub === "enable" }); await interaction.editReply(`Automod is now **${sub === "enable" ? "enabled" : "paused"}**. Saved settings were kept.`); return; }
    const categorySettings = { ...defaultCategorySettings(), ...config.categories };
    if (sub === "test") { const text = interaction.options.getString("text", true); const result = detectContent(text, config.words, { categories: categorySettings }); const links = detectLinks(text); const category = result.matched ? CATEGORIES[result.category] : null; await interaction.editReply(result.matched ? `**Private filter result**\nCategory: **${category?.label ?? result.category}**\nSeverity: **${result.severity}**\nConfidence: **${Math.round(result.confidence * 100)}%**\nRule: \`${result.id}\`\nAction if sent: **${result.actionOverride ?? categorySettings[result.category]?.action}**\nNo punishment or log was created.` : `No content rule matched.${links.invite ? " A Discord invite was detected." : links.link ? " A normal link was detected." : ""}`); return; }
    if (sub === "preset") { const preset = interaction.options.getString("name", true); const defaults = defaultCategorySettings(preset); this.store.applyAutomodCategories(id, defaults); await interaction.editReply(`🎀 Applied the **${preset}** preset${preset === "moderate" ? " (recommended)" : ""}.`); return; }
    if (sub === "category") { const category = interaction.options.getString("name", true); if (!CATEGORIES[category]) { await interaction.editReply(`Unknown category. Use one of: ${Object.keys(CATEGORIES).join(", ")}`); return; } this.store.setAutomodCategory(id, category, { enabled: interaction.options.getBoolean("enabled", true), action: interaction.options.getString("action", true) }); await interaction.editReply(`Updated **${CATEGORIES[category].label}**.`); return; }
    if (["blacklist-add", "blacklist-remove", "whitelist-add"].includes(sub)) { const term = interaction.options.getString("phrase", true); if (sub === "blacklist-remove") this.store.setAutomodRule(id, term, null); else this.store.setAutomodRule(id, term, sub === "whitelist-add" ? { severity: 0, category: "custom" } : { severity: interaction.options.getInteger("severity", true), category: interaction.options.getString("category") ?? "custom", actionOverride: interaction.options.getString("action") }); await interaction.editReply("🎀 Private custom language rules updated."); return; }
    if (sub === "settings") { const map = { mildAction: interaction.options.getString("mild-action"), linksEnabled: interaction.options.getBoolean("block-links"), invitesEnabled: interaction.options.getBoolean("block-invites"), strikesEnabled: interaction.options.getBoolean("strikes"), warningCooldownSeconds: interaction.options.getInteger("cooldown"), escalationThreshold: interaction.options.getInteger("threshold"), timeoutMinutes: interaction.options.getInteger("timeout") }; this.store.setAutomodConfig(id, Object.fromEntries(Object.entries(map).filter(([, value]) => value !== null))); await interaction.editReply("🎀 Automod enforcement settings saved."); return; }
    if (sub.startsWith("role-")) { const role = interaction.options.getRole("role", true); if (role.id === interaction.guild.id || role.managed) { await interaction.editReply("Choose a normal, non-managed role."); return; } if (interaction.user.id !== interaction.guild.ownerId && role.position >= interaction.member.roles.highest.position) { await interaction.editReply("You can only configure roles below your highest role; the server owner overrides this limit."); return; } this.store.setAutomodRole(id, role.id, interaction.options.getString("kind", true), sub === "role-add"); await interaction.editReply(`Updated automod access for ${role}.`); return; }
    if (sub === "channel") { const channel = interaction.options.getChannel("channel", true); const mode = interaction.options.getString("mode", true); this.store.setAutomodChannel(id, channel.id, mode === "default" ? null : mode); await interaction.editReply(`Saved ${channel}'s automod override: **${mode}**.`); return; }
    if (["word-add", "word-remove", "whitelist"].includes(sub)) { const word = interaction.options.getString("word", true); this.store.setAutomodWord(id, word, sub === "word-add" ? interaction.options.getInteger("tier", true) : sub === "whitelist" ? 0 : null); await interaction.editReply("Private custom word rules updated. They are only shown in automod status."); return; }
    const current = this.config(id); const currentCategories = { ...defaultCategorySettings(), ...current.categories }; const grouped = Object.fromEntries(["bypass", "manager", "link", "invite"].map((kind) => [kind, current.roles.filter((r) => r.kind === kind).map((r) => `<@&${r.roleId}>`).join(", ") || "None"]));
    const embed = new EmbedBuilder().setColor(0xf4a7c2).setTitle("🎀 Sofra Automod Status").addFields({ name: "Master toggle", value: current.enabled ? "Enabled" : "Paused", inline: true }, { name: "Categories", value: Object.entries(CATEGORIES).map(([key, value]) => `${value.emoji} ${value.label} — ${currentCategories[key].enabled ? "✅" : "❌"} (${currentCategories[key].action})`).join("\n") }, { name: "Links / invites", value: `${current.linksEnabled ? "Blocked" : "Allowed"} / ${current.invitesEnabled ? "Blocked" : "Allowed"}`, inline: true }, { name: "Cooldown / escalation", value: `${current.warningCooldownSeconds}s / ${current.escalationThreshold} in 5m / ${current.timeoutMinutes}m timeout` }, { name: "Roles", value: `Bypass: ${grouped.bypass}\nManagers: ${grouped.manager}\nLinks: ${grouped.link}\nInvites: ${grouped.invite}` }, { name: "Overrides / custom rules", value: `${current.channels.length} channel(s) • ${current.words.filter((w) => (w.severity ?? w.tier) > 0).length} blocked • ${current.words.filter((w) => (w.severity ?? w.tier) === 0).length} whitelisted` }).setFooter({ text: "Moderate is recommended. /automod test never punishes or logs." }); await interaction.editReply({ embeds: [embed], allowedMentions: { parse: [] } });
  }

  async handleMessage(message) {
    try {
      if (!message.guild || message.author?.bot || message.webhookId || !this.store.getHealth().ok) return false;
      const config = this.config(message.guild.id); if (!config.enabled) return false;
      const channelRule = config.channels.find((item) => item.channelId === message.channelId || item.channelId === message.channel?.parentId); if (channelRule?.mode === "exempt") return false;
      const owner = message.author.id === message.guild.ownerId; if (owner || this.hasRole(message.member, config, "bypass")) return false;
      const text = [message.content, ...(message.embeds ?? []).flatMap((embed) => [embed.title, embed.description, embed.footer?.text, ...(embed.fields ?? []).flatMap((field) => [field.name, field.value])])].filter(Boolean).join("\n");
      const categories = { ...defaultCategorySettings(), ...config.categories }; const result = detectContent(text, config.words, { categories, mentionCount: message.mentions?.users?.size ?? 0 }); const links = detectLinks(message.content);
      let kind = null; let tier = result.tier;
      if (links.invite && config.invitesEnabled && !this.hasRole(message.member, config, "invite")) { kind = "invite"; tier = 2; }
      else if (links.link && config.linksEnabled && !links.invite && !this.hasRole(message.member, config, "link")) { kind = "link"; tier = 3; }
      else if (result.matched) kind = "content"; else return false;
      const categoryAction = kind === "content" ? (result.actionOverride ?? categories[result.category]?.action ?? "delete_warn") : null;
      if (categoryAction === "ignore") return false;
      if (tier === 3 && (config.mildAction === "allow" || channelRule?.mode === "relaxed") && kind === "content") return false;
      const shouldDelete = kind !== "content" || categoryAction?.startsWith("delete") || (tier === 3 && config.mildAction === "delete");
      if (shouldDelete && message.deletable) await message.delete();
      const key = `${message.guild.id}:${message.author.id}`; const now = this.now(); const recent = (this.violations.get(key) ?? []).filter((time) => now - time < 300_000); recent.push(now); this.violations.set(key, recent);
      let escalated = false; if ((categoryAction?.includes("timeout") || recent.length === config.escalationThreshold) && config.timeoutMinutes > 0 && message.member?.moderatable) { await message.member.timeout(config.timeoutMinutes * 60_000, "Sofra automod violation"); escalated = true; }
      if (categoryAction === "delete_kick" && message.member?.kickable) await message.member.kick("Sofra automod violation");
      if (categoryAction === "delete_ban" && message.member?.bannable) await message.member.ban({ reason: "Sofra automod violation", deleteMessageSeconds: 0 });
      let strike = null; if ((result.severity === 4 || categoryAction === "strike") && config.strikesEnabled) strike = this.store.addWarning({ guildId: message.guild.id, userId: message.author.id, moderatorId: this.client.user.id, reason: `Automod: ${result.category}` });
      const lastWarn = this.warningTimes.get(key) ?? 0; const warnAllowed = now - lastWarn >= config.warningCooldownSeconds * 1000; const warningRequired = kind !== "content" || categoryAction?.includes("warn") || categoryAction === "warn";
      if (warnAllowed && warningRequired && message.channel?.send) { const pool = WARNINGS[kind === "content" ? tier : kind] ?? WARNINGS[2]; await message.channel.send({ content: `<@${message.author.id}> ${pool[Math.floor(this.random() * pool.length)]}\n**Reason:** ${CATEGORIES[result.category]?.label ?? `${kind} rule`}`, allowedMentions: { users: [message.author.id], roles: [], repliedUser: false } }); this.warningTimes.set(key, now); }
      const recentLogs = (this.logTimes.get(key) ?? []).filter((time) => now - time < 60_000);
      if (recentLogs.length < 5 || escalated) {
        recentLogs.push(now); this.logTimes.set(key, recentLogs);
        const redacted = kind === "content" && (CATEGORIES[result.category]?.redact || result.severity >= 4); await this.modLogService?.logAction(message.guild, { action: "automod", moderator: this.client.user, target: message.author, channel: message.channel, reason: `${kind === "content" ? CATEGORIES[result.category]?.label ?? result.category : `${kind} rule`} • Severity ${result.severity ?? tier}`, details: `Message ID: ${message.id}\nRule: ${result.id ?? kind}\nMatched: ${redacted ? "[REDACTED]" : "[content hidden]"}\nAction: ${categoryAction ?? (shouldDelete ? "deleted" : "warning")}${strike ? ` • strike ${strike.total}` : ""}${escalated ? ` • ${config.timeoutMinutes}m timeout` : ""}`, source: "Sofra automod" });
      }
      return true;
    } catch (error) { this.logger.error("AUTOMOD_MESSAGE_FAILED", "A message could not be filtered safely.", error, { guildId: message.guild?.id, messageId: message.id }); return false; }
  }
}
