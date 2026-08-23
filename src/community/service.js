import {
  ActionRowBuilder,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
  escapeMarkdown,
} from "discord.js";
import { fetchSafeMeme } from "./meme.js";

const SOFRA_COLORS = Object.freeze([0xf4a7c2, 0xf8c8d8, 0xd8b4e8]);
const EMBED_MODAL_PREFIX = "sofra_embed:";
const PUBLIC_COMMANDS = new Set(["userinfo", "serverinfo", "meme"]);
const COMMUNITY_COMMANDS = new Set([
  "userinfo",
  "serverinfo",
  "embed",
  "poll",
  "meme",
]);
const POLL_EMOJIS = Object.freeze(["🎀", "🌸", "✨", "☁️", "🩷"]);

function discordTimestamp(milliseconds, style = "F") {
  return milliseconds ? `<t:${Math.floor(milliseconds / 1_000)}:${style}>` : "Unknown";
}

function safeText(value) {
  return escapeMarkdown(String(value ?? "Unknown")).replaceAll("@", "@\u200b");
}

function parseColor(value) {
  const normalized = value.trim().replace(/^#/, "");
  if (!normalized) return SOFRA_COLORS[0];
  if (!/^[\dA-Fa-f]{6}$/.test(normalized)) return null;
  return Number.parseInt(normalized, 16);
}

function optionalHttpsUrl(value) {
  if (!value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" ? url.toString() : false;
  } catch {
    return false;
  }
}

function textInput({ id, label, style, required, maxLength, placeholder }) {
  return new ActionRowBuilder().addComponents(
    new TextInputBuilder()
      .setCustomId(id)
      .setLabel(label)
      .setStyle(style)
      .setRequired(required)
      .setMaxLength(maxLength)
      .setPlaceholder(placeholder),
  );
}

export class CommunityService {
  constructor({ client, logger, memeFetcher = fetchSafeMeme }) {
    this.client = client;
    this.logger = logger;
    this.memeFetcher = memeFetcher;
  }

  async handleInteraction(interaction) {
    if (
      interaction.isModalSubmit() &&
      interaction.customId.startsWith(EMBED_MODAL_PREFIX)
    ) {
      await this.handleEmbedModal(interaction);
      return true;
    }

    if (
      !interaction.isChatInputCommand() ||
      !COMMUNITY_COMMANDS.has(interaction.commandName)
    ) {
      return false;
    }

    const command = interaction.commandName;
    try {
      if (!interaction.inGuild() || !interaction.guild) {
        await interaction.reply({
          content: "୨୧ This command can only be used inside a server.",
          flags: MessageFlags.Ephemeral,
        });
        return true;
      }

      if (command === "embed") {
        await this.openEmbedModal(interaction);
        return true;
      }

      if (command === "poll") {
        await this.poll(interaction);
        return true;
      }

      await interaction.deferReply();
      await this[command](interaction);
      return true;
    } catch (error) {
      this.logger.error(
        "COMMUNITY_COMMAND_FAILED",
        `/${command} failed without affecting Sofra’s other features.`,
        error,
        { guildId: interaction.guildId, userId: interaction.user?.id, command },
      );
      await this.replyWithFailure(interaction, command, PUBLIC_COMMANDS.has(command));
      return true;
    }
  }

  async userinfo(interaction) {
    const user = interaction.options.getUser("member") ?? interaction.user;
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) {
      await interaction.editReply("That user is not currently a member of this server.");
      return;
    }

    const roles = member.roles.cache
      .filter((role) => role.id !== interaction.guild.id)
      .sort((left, right) => right.position - left.position)
      .map((role) => `<@&${role.id}>`);
    let roleText = roles.length ? roles.join(" • ") : "No assigned roles";
    if (roleText.length > 1_024) {
      roleText = `${roleText.slice(0, 1_000)}…`;
    }

    const embed = new EmbedBuilder()
      .setColor(member.displayColor || SOFRA_COLORS[0])
      .setAuthor({ name: "♡ Sofra Member Information" })
      .setTitle(`${safeText(member.displayName)} ୨୧`)
      .setThumbnail(user.displayAvatarURL({ extension: "png", size: 256 }))
      .addFields(
        { name: "🌸 User", value: `<@${user.id}>\n\`${user.id}\``, inline: true },
        {
          name: "🎀 Account Created",
          value: `${discordTimestamp(user.createdTimestamp)}\n${discordTimestamp(user.createdTimestamp, "R")}`,
          inline: true,
        },
        {
          name: "☁️ Joined Server",
          value: `${discordTimestamp(member.joinedTimestamp)}\n${discordTimestamp(member.joinedTimestamp, "R")}`,
          inline: true,
        },
        {
          name: `✨ Roles (${Math.max(0, member.roles.cache.size - 1)})`,
          value: roleText,
          inline: false,
        },
      )
      .setFooter({ text: "Sofra ♡ Member Info" })
      .setTimestamp();
    await interaction.editReply({ embeds: [embed], allowedMentions: { parse: [] } });
  }

  async serverinfo(interaction) {
    const guild = interaction.guild;
    const owner = await guild.fetchOwner().catch(() => null);
    const embed = new EmbedBuilder()
      .setColor(SOFRA_COLORS[2])
      .setAuthor({ name: "♡ Sofra Server Information" })
      .setTitle(`${safeText(guild.name)} ୨୧`)
      .addFields(
        {
          name: "🌸 Members",
          value: `**${guild.memberCount.toLocaleString("en-US")} total members**`,
          inline: true,
        },
        {
          name: "🎀 Boost Status",
          value: `Level **${guild.premiumTier}**\n${guild.premiumSubscriptionCount ?? 0} boost(s)`,
          inline: true,
        },
        {
          name: "☁️ Owner",
          value: owner ? `<@${owner.id}>\n\`${owner.id}\`` : `\`${guild.ownerId}\``,
          inline: true,
        },
        {
          name: "✨ Created",
          value: `${discordTimestamp(guild.createdTimestamp)}\n${discordTimestamp(guild.createdTimestamp, "R")}`,
          inline: true,
        },
        {
          name: "🫧 Community",
          value: `${guild.channels.cache.size} channels • ${Math.max(0, guild.roles.cache.size - 1)} roles`,
          inline: true,
        },
        { name: "୨୧ Server ID", value: `\`${guild.id}\``, inline: true },
      )
      .setFooter({ text: "Sofra ♡ Server Info" })
      .setTimestamp();
    const iconUrl = guild.iconURL({ extension: "png", size: 256 });
    if (iconUrl) embed.setThumbnail(iconUrl);
    await interaction.editReply({ embeds: [embed], allowedMentions: { parse: [] } });
  }

  async openEmbedModal(interaction) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
      await interaction.reply({
        content: "You need **Manage Messages** permission to create announcements.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const channel = interaction.options.getChannel("channel") ?? interaction.channel;
    if (!this.isAnnouncementChannel(interaction.guild, channel)) {
      await interaction.reply({
        content: "Choose a regular text or announcement channel.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(`${EMBED_MODAL_PREFIX}${channel.id}`)
      .setTitle("♡ Build a Sofra announcement")
      .addComponents(
        textInput({
          id: "title",
          label: "Title (optional)",
          style: TextInputStyle.Short,
          required: false,
          maxLength: 256,
          placeholder: "A lovely announcement 🎀",
        }),
        textInput({
          id: "description",
          label: "Announcement",
          style: TextInputStyle.Paragraph,
          required: true,
          maxLength: 4_000,
          placeholder: "Write the announcement here…",
        }),
        textInput({
          id: "color",
          label: "Hex color (optional)",
          style: TextInputStyle.Short,
          required: false,
          maxLength: 7,
          placeholder: "#F4A7C2",
        }),
        textInput({
          id: "footer",
          label: "Footer (optional)",
          style: TextInputStyle.Short,
          required: false,
          maxLength: 2_048,
          placeholder: "Itsmefeje Studios ♡",
        }),
        textInput({
          id: "image",
          label: "HTTPS image URL (optional)",
          style: TextInputStyle.Short,
          required: false,
          maxLength: 1_000,
          placeholder: "https://…",
        }),
      );
    await interaction.showModal(modal);
  }

  async handleEmbedModal(interaction) {
    try {
      if (
        !interaction.inGuild() ||
        !interaction.guild ||
        !interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)
      ) {
        await interaction.reply({
          content: "You no longer have permission to create announcements.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const channelId = interaction.customId.slice(EMBED_MODAL_PREFIX.length);
      const channel =
        interaction.guild.channels.cache.get(channelId) ??
        (await interaction.guild.channels.fetch(channelId).catch(() => null));
      if (!this.isAnnouncementChannel(interaction.guild, channel)) {
        await interaction.editReply("The destination channel is missing or unsupported.");
        return;
      }
      const permissions = channel.permissionsFor(interaction.guild.members.me);
      if (
        !permissions?.has(PermissionFlagsBits.ViewChannel) ||
        !permissions.has(PermissionFlagsBits.SendMessages) ||
        !permissions.has(PermissionFlagsBits.EmbedLinks)
      ) {
        await interaction.editReply(
          "Sofra needs **View Channel**, **Send Messages**, and **Embed Links** in the destination.",
        );
        return;
      }

      const title = interaction.fields.getTextInputValue("title").trim();
      const description = interaction.fields.getTextInputValue("description").trim();
      const color = parseColor(interaction.fields.getTextInputValue("color"));
      const footer = interaction.fields.getTextInputValue("footer").trim();
      const imageUrl = optionalHttpsUrl(interaction.fields.getTextInputValue("image"));
      if (color === null) {
        await interaction.editReply("Use a six-digit hex color such as `#F4A7C2`.");
        return;
      }
      if (imageUrl === false) {
        await interaction.editReply("The image must be a valid `https://` URL.");
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(color)
        .setDescription(description)
        .setTimestamp();
      if (title) embed.setTitle(title);
      if (footer) embed.setFooter({ text: footer });
      if (imageUrl) embed.setImage(imageUrl);
      await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
      await interaction.editReply(`🎀 Your announcement was sent in ${channel}.`);
    } catch (error) {
      this.logger.error(
        "EMBED_MODAL_FAILED",
        "An embed-builder submission failed safely.",
        error,
        { guildId: interaction.guildId, userId: interaction.user?.id },
      );
      await this.replyWithFailure(interaction, "embed", false);
    }
  }

  async poll(interaction) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
      await interaction.reply({
        content: "You need **Manage Messages** permission to create polls.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const permissions = interaction.channel?.permissionsFor(
      interaction.guild.members.me,
    );
    if (
      !permissions?.has(PermissionFlagsBits.SendMessages) ||
      !permissions.has(PermissionFlagsBits.SendPolls)
    ) {
      await interaction.reply({
        content: "Sofra needs **Send Messages** and **Create Polls** in this channel.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const question = interaction.options.getString("question", true).trim();
    const answers = [];
    for (let index = 1; index <= 5; index += 1) {
      const answer = interaction.options.getString(`option-${index}`)?.trim();
      if (answer) answers.push({ text: answer, emoji: POLL_EMOJIS[index - 1] });
    }
    if (!question || answers.length < 2) {
      await interaction.reply({
        content: "Enter a question and at least two non-empty choices.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const unique = new Set(answers.map((answer) => answer.text.toLowerCase()));
    if (unique.size !== answers.length) {
      await interaction.reply({
        content: "Each poll option must be different.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await interaction.reply({
      content: `୨୧ **Poll created by ${safeText(interaction.user.displayName ?? interaction.user.username)}**`,
      poll: {
        question: { text: question },
        answers,
        duration: interaction.options.getInteger("duration-hours") ?? 24,
        allowMultiselect: false,
      },
      allowedMentions: { parse: [] },
    });
  }

  async meme(interaction) {
    const meme = await this.memeFetcher();
    const embed = new EmbedBuilder()
      .setColor(SOFRA_COLORS[1])
      .setTitle(safeText(meme.title).slice(0, 256))
      .setImage(meme.imageUrl)
      .setFooter({
        text: `r/${meme.subreddit} • ${meme.upvotes.toLocaleString("en-US")} upvotes • SFW`,
      })
      .setTimestamp();
    if (meme.postUrl) embed.setURL(meme.postUrl);
    await interaction.editReply({ embeds: [embed], allowedMentions: { parse: [] } });
  }

  isAnnouncementChannel(guild, channel) {
    return Boolean(
      channel &&
        channel.guildId === guild.id &&
        [ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type) &&
        typeof channel.send === "function",
    );
  }

  async replyWithFailure(interaction, command, publicResponse) {
    const content = `Sofra couldn’t complete /${command}. Please try again and check the Wispbyte console if it continues.`;
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content, embeds: [] });
      } else if (publicResponse) {
        await interaction.reply({ content });
      } else {
        await interaction.reply({
          content,
          flags: MessageFlags.Ephemeral,
        });
      }
    } catch (replyError) {
      this.logger.error(
        "COMMUNITY_REPLY_FAILED",
        "Discord rejected a community-command error response.",
        replyError,
        { guildId: interaction.guildId, command },
      );
    }
  }
}

export { parseColor };
