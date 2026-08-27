import {
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
} from "discord.js";
import { fetchConfiguredRole, inspectAutoRole } from "../autorole/role.js";
import { chooseBoosterThankYou } from "./messages.js";

const SOFRA_PINK = 0xf4a7c2;
const BOOST_IMAGE_URL =
  "https://cdn.discordapp.com/attachments/1488922538368307391/1542523644209659925/1E279775-7696-4C35-B9D8-05DCA0FAC19A.png";
const NITRO_ICON_REFERENCE = Object.freeze({
  guildId: "1372454538283323452",
  channelId: "1488922538368307391",
  messageId: "1542523819829231716",
});
const SEND_PERMISSIONS = Object.freeze([
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.EmbedLinks,
]);

function validateChannel(guild, channel) {
  const missing = [];
  if (
    !channel ||
    channel.guildId !== guild.id ||
    ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type) ||
    typeof channel.send !== "function"
  ) {
    return { valid: false, missing: ["valid text channel"] };
  }
  const permissions = channel.permissionsFor(guild.members.me);
  const labels = new Map([
    [PermissionFlagsBits.ViewChannel, "View Channel"],
    [PermissionFlagsBits.SendMessages, "Send Messages"],
    [PermissionFlagsBits.EmbedLinks, "Embed Links"],
  ]);
  for (const permission of SEND_PERMISSIONS) {
    if (!permissions?.has(permission)) missing.push(labels.get(permission));
  }
  return { valid: missing.length === 0, missing };
}

export function buildBoosterThankYouEmbeds({ member, message, iconURL = null, timestamp = Date.now() }) {
  const banner = new EmbedBuilder().setColor(SOFRA_PINK).setImage(BOOST_IMAGE_URL);
  const thanks = new EmbedBuilder()
    .setColor(SOFRA_PINK)
    .setAuthor({ name: "♡ Thanks for supporting itsmefeje studios!" })
    .setThumbnail(iconURL)
    .setDescription(`## Thank you for boosting, ${member}! 🎀\n\n${message}`)
    .addFields({
      name: "୨୧ Your support matters",
      value: "Every boost helps our community grow, unlock new perks, and become even more magical. We sincerely appreciate you! 🩷",
    })
    .setFooter({ text: "Sofra ♡ Booster Celebration" })
    .setTimestamp(timestamp);
  return [banner, thanks];
}

export class BoosterService {
  constructor({ client, store, logger, random = Math.random }) {
    this.client = client;
    this.store = store;
    this.logger = logger;
    this.random = random;
    this.inFlightMembers = new Set();
  }

  async handleInteraction(interaction) {
    if (!interaction.isChatInputCommand() || interaction.commandName !== "booster") return false;
    try {
      if (!interaction.inGuild() || !interaction.guild) {
        await interaction.reply({ content: "୨୧ Booster settings can only be used in a server.", flags: MessageFlags.Ephemeral });
        return true;
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.editReply("You need **Manage Server** to configure booster celebrations.");
        return true;
      }
      if (!this.store.getHealth().ok) {
        await interaction.editReply("Booster storage is unavailable. Check the Wispbyte console.");
        return true;
      }
      const subcommand = interaction.options.getSubcommand(true);
      await this[subcommand](interaction);
      return true;
    } catch (error) {
      this.logger.error("BOOSTER_COMMAND_FAILED", "A booster configuration command failed safely.", error, {
        guildId: interaction.guildId,
        userId: interaction.user?.id,
      });
      await interaction.editReply("Sofra couldn't complete that booster action. Check `/booster status` and the Wispbyte console.").catch(() => {});
      return true;
    }
  }

  async setup(interaction) {
    const role = interaction.options.getRole("role", true);
    const channel = interaction.options.getChannel("channel", true);
    const roleInspection = await inspectAutoRole({
      guild: interaction.guild,
      role,
      clientUserId: this.client.user.id,
      actorId: interaction.user.id,
    });
    if (!roleInspection.valid) {
      await interaction.editReply(`I can't use that booster role: **${roleInspection.reason}**`);
      return;
    }
    const channelInspection = validateChannel(interaction.guild, channel);
    if (!channelInspection.valid) {
      await interaction.editReply(`That channel is not ready. Sofra is missing: **${channelInspection.missing.join(", ")}**.`);
      return;
    }
    this.store.setBoosterConfig(interaction.guild.id, { roleId: role.id, channelId: channel.id });
    this.store.setBoosterEnabled(interaction.guild.id, true);
    await interaction.editReply(`🎀 Booster celebrations are enabled! New boosters receive ${role}, and thank-you embeds will appear in ${channel}.`);
  }

  async enable(interaction) {
    const inspection = await this.inspectConfig(interaction.guild);
    if (!inspection.valid) {
      await interaction.editReply("Run `/booster setup` with a valid custom role and channel first.");
      return;
    }
    this.store.setBoosterEnabled(interaction.guild.id, true);
    await interaction.editReply(`🩷 Booster celebrations are enabled in ${inspection.channel}.`);
  }

  async disable(interaction) {
    this.store.setBoosterEnabled(interaction.guild.id, false);
    await interaction.editReply("☁️ Booster celebrations are disabled. The saved role and channel were kept.");
  }

  async test(interaction) {
    const inspection = await this.inspectConfig(interaction.guild);
    if (!inspection.valid) {
      await interaction.editReply("The saved booster setup is invalid. Run `/booster setup` again.");
      return;
    }
    const member = await interaction.guild.members.fetch(interaction.user.id);
    await this.sendThankYou(member, inspection.channel);
    await interaction.editReply(`✨ A randomized booster thank-you preview was sent in ${inspection.channel}.`);
  }

  async status(interaction) {
    const config = this.store.getBoosterConfig(interaction.guild.id);
    const inspection = await this.inspectConfig(interaction.guild);
    const embed = new EmbedBuilder()
      .setColor(inspection.valid ? 0x81c784 : SOFRA_PINK)
      .setAuthor({ name: "♡ Sofra Booster Celebrations" })
      .setTitle("୨୧ Booster Status")
      .addFields(
        { name: "🎀 System", value: config.enabled ? "✅ Enabled" : "⏸️ Disabled", inline: true },
        { name: "💎 Booster Role", value: inspection.role ? `${inspection.role}` : "Not configured", inline: true },
        { name: "🌸 Thank-you Channel", value: inspection.channel ? `${inspection.channel}` : "Not configured", inline: true },
        { name: "✨ Role Assignment", value: inspection.roleInspection.valid ? "Ready" : inspection.roleInspection.reason, inline: false },
        { name: "🫧 Channel Access", value: inspection.channelInspection.valid ? "View Channel, Send Messages, Embed Links" : inspection.channelInspection.missing.join(", "), inline: false },
        { name: "୨୧ Configuration", value: inspection.valid ? "Ready to celebrate boosts" : "Needs attention", inline: false },
      )
      .setFooter({ text: "Sofra ♡ Booster Settings" })
      .setTimestamp();
    await interaction.editReply({ embeds: [embed], allowedMentions: { parse: [] } });
  }

  async handleMemberUpdate(oldMember, newMember) {
    const startedBoosting = !oldMember.premiumSinceTimestamp && Boolean(newMember.premiumSinceTimestamp);
    const stoppedBoosting = Boolean(oldMember.premiumSinceTimestamp) && !newMember.premiumSinceTimestamp;
    if ((!startedBoosting && !stoppedBoosting) || newMember.user.bot || !this.store.getHealth().ok) return;
    const key = `${newMember.guild.id}:${newMember.id}`;
    if (this.inFlightMembers.has(key)) return;
    this.inFlightMembers.add(key);
    try {
      const config = this.store.getBoosterConfig(newMember.guild.id);
      if (!config.enabled) return;
      const role = await fetchConfiguredRole(newMember.guild, config.roleId);
      const roleInspection = await inspectAutoRole({ guild: newMember.guild, role, clientUserId: this.client.user.id });
      if (!roleInspection.valid) {
        this.logger.warn("BOOSTER_ROLE_INVALID", "A booster role update was skipped because its configuration is invalid.", { guildId: newMember.guild.id, memberId: newMember.id, reason: roleInspection.reason });
        return;
      }
      if (startedBoosting) {
        if (!newMember.roles.cache.has(role.id)) {
          await newMember.roles.add(role, "Sofra Server Booster role assignment");
        }
        const channel = await this.resolveChannel(newMember.guild, config.channelId);
        if (!validateChannel(newMember.guild, channel).valid) {
          this.logger.warn("BOOSTER_CHANNEL_INVALID", "The booster role was assigned, but the thank-you channel is unavailable.", { guildId: newMember.guild.id, memberId: newMember.id, channelId: config.channelId });
          return;
        }
        await this.sendThankYou(newMember, channel);
        this.logger.info("BOOSTER_CELEBRATED", "A new boost was celebrated and the booster role was assigned.", { guildId: newMember.guild.id, memberId: newMember.id, roleId: role.id, channelId: channel.id });
      } else if (newMember.roles.cache.has(role.id)) {
        await newMember.roles.remove(role, "Sofra Server Booster role removal after boost ended");
        this.logger.info("BOOSTER_ROLE_REMOVED", "The configured booster role was removed after boosting ended.", { guildId: newMember.guild.id, memberId: newMember.id, roleId: role.id });
      }
    } catch (error) {
      this.logger.error("BOOSTER_UPDATE_FAILED", "A booster update failed without affecting Sofra's other features.", error, { guildId: newMember.guild.id, memberId: newMember.id });
    } finally {
      this.inFlightMembers.delete(key);
    }
  }

  async sendThankYou(member, channel) {
    const iconURL = await this.resolveNitroIcon(member.guild);
    await channel.send({
      embeds: buildBoosterThankYouEmbeds({ member, message: chooseBoosterThankYou(this.random), iconURL }),
      allowedMentions: { users: [member.id], roles: [], repliedUser: false },
    });
  }

  async resolveNitroIcon(guild) {
    if (guild.id !== NITRO_ICON_REFERENCE.guildId) return this.client.user.displayAvatarURL({ extension: "gif", size: 128 });
    try {
      const channel = await this.resolveChannel(guild, NITRO_ICON_REFERENCE.channelId);
      const message = await channel?.messages?.fetch(NITRO_ICON_REFERENCE.messageId);
      const attachment = message?.attachments?.find((item) => item.contentType?.startsWith("image/")) ?? message?.attachments?.first?.();
      const embeddedImage = message?.embeds?.find((embed) => embed.image?.url || embed.thumbnail?.url);
      return attachment?.url ?? embeddedImage?.image?.url ?? embeddedImage?.thumbnail?.url ?? this.client.user.displayAvatarURL({ extension: "gif", size: 128 });
    } catch (error) {
      this.logger.warn("BOOSTER_NITRO_ICON_UNAVAILABLE", "The referenced Nitro GIF could not be loaded; Sofra's avatar was used instead.", { guildId: guild.id, error: error?.message });
      return this.client.user.displayAvatarURL({ extension: "gif", size: 128 });
    }
  }

  async inspectConfig(guild) {
    const config = this.store.getBoosterConfig(guild.id);
    const role = await fetchConfiguredRole(guild, config.roleId);
    const roleInspection = await inspectAutoRole({ guild, role, clientUserId: this.client.user.id });
    const channel = await this.resolveChannel(guild, config.channelId);
    const channelInspection = validateChannel(guild, channel);
    return { config, role, channel, roleInspection, channelInspection, valid: roleInspection.valid && channelInspection.valid };
  }

  async resolveChannel(guild, channelId) {
    if (!channelId) return null;
    return guild.channels.cache.get(channelId) ?? guild.channels.fetch(channelId).catch(() => null);
  }

  handleRoleDelete(role) {
    if (!this.store.getHealth().ok) return;
    try {
      const config = this.store.getBoosterConfig(role.guild.id);
      if (config.roleId === role.id) {
        this.store.clearBoosterRole(role.guild.id);
        this.logger.warn("BOOSTER_ROLE_DELETED", "The configured booster role was deleted, so booster celebrations were disabled.", { guildId: role.guild.id, roleId: role.id });
      }
    } catch (error) {
      this.logger.error("BOOSTER_ROLE_DELETE_CLEANUP_FAILED", "A deleted booster role could not be cleared from configuration.", error, { guildId: role.guild.id, roleId: role.id });
    }
  }

  handleChannelDelete(channel) {
    if (!channel.guild || !this.store.getHealth().ok) return;
    try {
      const config = this.store.getBoosterConfig(channel.guild.id);
      if (config.channelId === channel.id) {
        this.store.clearBoosterChannel(channel.guild.id);
        this.logger.warn("BOOSTER_CHANNEL_DELETED", "The configured booster thank-you channel was deleted, so booster celebrations were disabled.", { guildId: channel.guild.id, channelId: channel.id });
      }
    } catch (error) {
      this.logger.error("BOOSTER_CHANNEL_DELETE_CLEANUP_FAILED", "A deleted booster channel could not be cleared from configuration.", error, { guildId: channel.guild.id, channelId: channel.id });
    }
  }
}
