import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
} from "discord.js";

const SOFRA_PINK = 0xf4a7c2;
const PANEL_BANNER =
  "https://cdn.discordapp.com/attachments/1489489015269883954/1542155954894807060/file_00000000c470821189498cb6c7c22668.png?ex=6a903427&is=6a8ee2a7&hm=b81ddd90b880a344e24f9a1ef98df817055cd9876bb28d364de8d734647a6bc3&";
const TYPES = Object.freeze({
  bug: {
    name: "Bug Report",
    prefix: "bug",
    emoji: "🪲",
    style: ButtonStyle.Success,
    prompt:
      "Please provide:\n• A clear description of the bug\n• Steps to reproduce it\n• Screenshots or video, if available\n• What you expected to happen\n• What actually happened",
  },
  report: {
    name: "Player Report",
    prefix: "report",
    emoji: "⚒️",
    style: ButtonStyle.Danger,
    prompt:
      "Please provide:\n• The player's username and User ID\n• What happened\n• Screenshots, video, or other evidence\n• The approximate time of the incident",
  },
  other: {
    name: "Other",
    prefix: "other",
    emoji: "💬",
    style: ButtonStyle.Secondary,
    prompt: "Please explain your question, concern, or issue as clearly as possible.",
  },
});
const STAFF_ACCESS = Object.freeze({
  ViewChannel: true,
  SendMessages: true,
  ReadMessageHistory: true,
  AttachFiles: true,
  EmbedLinks: true,
});
const STAFF_PERMISSION_NAMES = Object.freeze(Object.keys(STAFF_ACCESS));

function ticketNumber(id) {
  return String(id).padStart(4, "0");
}

export function buildTicketPanel() {
  const banner = new EmbedBuilder().setColor(SOFRA_PINK).setImage(PANEL_BANNER);
  const panel = new EmbedBuilder()
    .setColor(SOFRA_PINK)
    .setAuthor({ name: "♡ Sofra Support Center" })
    .setTitle("🎫 How can we help you?")
    .setDescription(
      "Choose the ticket type that best matches your concern. Sofra will create a private channel visible only to you and the staff team.",
    )
    .addFields(
      {
        name: "🪲 Bug Reports",
        value:
          "Report bugs, glitches, broken systems, exploits, or other game issues. Thorough, valid reports may be eligible for approximately **1,000–100,000 Robux**, depending on severity and importance. Critical bugs and exploits receive higher consideration; rewards are not guaranteed.",
      },
      {
        name: "⚒️ Player Reports",
        value:
          "Report exploiting, bug abuse, scams, harassment, rule-breaking, or other harmful player behavior.",
      },
      {
        name: "💬 Others",
        value:
          "Ask private questions or get help with account/game issues, general support, concerns, or anything that does not fit above.",
      },
    )
    .setFooter({ text: "One open ticket per type, per member • Sofra ♡" });
  const row = new ActionRowBuilder().addComponents(
    ...Object.entries(TYPES).map(([type, details]) =>
      new ButtonBuilder()
        .setCustomId(`ticket:create:${type}`)
        .setLabel(type === "other" ? "Others" : `${details.name}s`)
        .setEmoji(details.emoji)
        .setStyle(details.style),
    ),
  );
  return { embeds: [banner, panel], components: [row] };
}

export function buildTicketInformation(ticket) {
  const details = TYPES[ticket.type];
  const status = ticket.status === "closed" ? "Closed" : "Open";
  const embed = new EmbedBuilder()
    .setColor(ticket.status === "closed" ? 0xb0bec5 : SOFRA_PINK)
    .setAuthor({ name: "♡ Sofra Private Support" })
    .setTitle(`${details.emoji} ${details.name} — #${ticketNumber(ticket.id)}`)
    .setDescription(
      `A staff member will assist you as soon as possible. Please keep all relevant details in this channel.\n\n${details.prompt}`,
    )
    .addFields(
      { name: "🎟️ Ticket ID", value: `#${ticketNumber(ticket.id)}`, inline: true },
      { name: "🎀 Created By", value: `<@${ticket.creatorId}>`, inline: true },
      { name: "🌸 Ticket Type", value: details.name, inline: true },
      {
        name: "🕐 Created At",
        value: `<t:${Math.floor(ticket.createdAt / 1_000)}:F>`,
        inline: true,
      },
      { name: "☁️ Status", value: status, inline: true },
      {
        name: "👤 Claimed By",
        value: ticket.claimedBy ? `<@${ticket.claimedBy}>` : "Not claimed yet",
        inline: true,
      },
    )
    .setFooter({ text: "Sofra ♡ Support Ticket" })
    .setTimestamp(ticket.createdAt);
  return embed;
}

function ticketControls(ticket) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("ticket:claim")
        .setLabel("Claim Ticket")
        .setEmoji("👤")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("ticket:close")
        .setLabel("Close Ticket")
        .setEmoji("🔒")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(ticket.status !== "open"),
      new ButtonBuilder()
        .setCustomId("ticket:reopen")
        .setLabel("Reopen Ticket")
        .setEmoji("🔓")
        .setStyle(ButtonStyle.Success)
        .setDisabled(ticket.status !== "closed"),
      new ButtonBuilder()
        .setCustomId("ticket:delete")
        .setLabel("Delete Ticket")
        .setEmoji("🗑️")
        .setStyle(ButtonStyle.Danger),
    ),
  ];
}

export class TicketService {
  constructor({ client, store, logger, modLogService }) {
    this.client = client;
    this.store = store;
    this.logger = logger;
    this.modLogService = modLogService;
  }

  async handleInteraction(interaction) {
    const isSetup = interaction.isChatInputCommand() && interaction.commandName === "ticket-channel";
    const isTicketButton = interaction.isButton() && interaction.customId.startsWith("ticket:");
    if (!isSetup && !isTicketButton) return false;

    try {
      if (isSetup) await this.setup(interaction);
      else await this.handleButton(interaction);
    } catch (error) {
      this.logger.error("TICKET_INTERACTION_FAILED", "A ticket interaction failed safely.", error, {
        guildId: interaction.guildId,
        userId: interaction.user?.id,
        customId: interaction.customId,
      });
      await this.failureReply(interaction);
    }
    return true;
  }

  async setup(interaction) {
    if (!interaction.inGuild() || !interaction.guild) {
      await interaction.reply({ content: "Tickets can only be configured in a server.", flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.editReply("You need **Manage Server** to configure tickets.");
      return;
    }
    if (!this.store.getHealth().ok) {
      await interaction.editReply("Ticket storage is unavailable. Check disk space and the Wispbyte console.");
      return;
    }
    const bot = interaction.guild.members.me;
    if (!bot?.permissions.has(PermissionFlagsBits.ManageChannels)) {
      await interaction.editReply("Sofra needs **Manage Channels** to create and manage private tickets.");
      return;
    }

    const panelChannel = interaction.options.getChannel("panel-channel", true);
    const category = interaction.options.getChannel("ticket-category", true);
    const roleIds = [
      ...new Set(
        ["staff-role", "staff-role-2", "staff-role-3", "staff-role-4", "staff-role-5"]
          .map((name) => interaction.options.getRole(name))
          .filter(Boolean)
          .map((role) => role.id),
      ),
    ];
    const staffLogOption = interaction.options.getChannel("staff-logs");
    if (category.type !== ChannelType.GuildCategory || panelChannel.type !== ChannelType.GuildText) {
      await interaction.editReply("Choose a normal text channel and a valid ticket category.");
      return;
    }
    if (roleIds.includes(interaction.guild.roles.everyone.id)) {
      await interaction.editReply("`@everyone` cannot be a ticket staff role because tickets must remain private.");
      return;
    }
    const panelPermissions = panelChannel.permissionsFor(bot);
    const missingPanelPermission = [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.EmbedLinks,
    ].some((permission) => !panelPermissions?.has(permission));
    if (missingPanelPermission) {
      await interaction.editReply("Sofra needs **View Channel**, **Send Messages**, and **Embed Links** in the panel channel.");
      return;
    }
    const categoryPermissions = category.permissionsFor(bot);
    if (
      !categoryPermissions?.has(PermissionFlagsBits.ViewChannel) ||
      !categoryPermissions.has(PermissionFlagsBits.ManageChannels)
    ) {
      await interaction.editReply(
        "Sofra needs **View Channel** and **Manage Channels** in the selected ticket category.",
      );
      return;
    }

    const previousTicketConfig = this.store.getTicketConfig(interaction.guild.id);
    const existingLogs = this.store.getModLogConfig(interaction.guild.id);
    const staffLogChannel = staffLogOption ?? (await this.modLogService.resolveChannel(interaction.guild, existingLogs.channelId));
    const logValidation = this.modLogService.validateChannel(interaction.guild, staffLogChannel);
    if (!logValidation.valid) {
      await interaction.editReply(
        "Select a valid `staff-logs` channel, or configure one first with `/modlog setup`. Ticket events require the shared Staff Logs system.",
      );
      return;
    }

    const panelMessage = await panelChannel.send({
      ...buildTicketPanel(),
      allowedMentions: { parse: [] },
    });
    try {
      this.store.setTicketConfig({
        guildId: interaction.guild.id,
        panelChannelId: panelChannel.id,
        panelMessageId: panelMessage.id,
        categoryId: category.id,
        staffRoleIds: roleIds,
      });
      if (staffLogOption) this.store.setModLogChannel(interaction.guild.id, staffLogOption.id);
      this.store.setModLogEnabled(interaction.guild.id, true);
    } catch (error) {
      await panelMessage.delete().catch(() => undefined);
      throw error;
    }
    if (
      previousTicketConfig.panelMessageId &&
      previousTicketConfig.panelMessageId !== panelMessage.id &&
      previousTicketConfig.panelChannelId
    ) {
      const previousChannel =
        interaction.guild.channels.cache.get(previousTicketConfig.panelChannelId) ??
        (await interaction.guild.channels
          .fetch(previousTicketConfig.panelChannelId)
          .catch(() => null));
      if (previousChannel?.messages?.fetch) {
        const previousMessage = await previousChannel.messages
          .fetch(previousTicketConfig.panelMessageId)
          .catch(() => null);
        if (previousMessage) await previousMessage.delete().catch(() => undefined);
      }
    }

    await interaction.editReply(
      `🎀 Ticket panel posted in ${panelChannel}. New tickets will be created under **${category.name}**, visible to ${roleIds.map((id) => `<@&${id}>`).join(", ")}, with events sent to ${staffLogChannel}.`,
    );
  }

  async handleButton(interaction) {
    if (!interaction.inGuild() || !interaction.guild) {
      await interaction.reply({ content: "Ticket controls only work inside the server.", flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if (!this.store.getHealth().ok) {
      await interaction.editReply("Ticket storage is temporarily unavailable. Please contact staff.");
      return;
    }
    const [, action, type] = interaction.customId.split(":");
    if (action === "create") {
      await this.create(interaction, type);
      return;
    }
    const ticket = this.store.getTicketByChannel(interaction.guild.id, interaction.channelId);
    if (!ticket || ticket.status === "deleted") {
      await interaction.editReply("This channel is not an active Sofra ticket.");
      return;
    }
    if (!this.isStaff(interaction)) {
      await interaction.editReply("Only configured ticket staff can use these controls.");
      return;
    }
    if (action === "claim") await this.claim(interaction, ticket);
    else if (action === "close") await this.close(interaction, ticket);
    else if (action === "reopen") await this.reopen(interaction, ticket);
    else if (action === "delete") await this.confirmDelete(interaction, ticket);
    else if (action === "delete-confirm") await this.delete(interaction, ticket);
    else if (action === "delete-cancel") await interaction.editReply("Ticket deletion cancelled.");
    else await interaction.editReply("That ticket control is no longer supported.");
  }

  async create(interaction, type) {
    const details = TYPES[type];
    if (!details) {
      await interaction.editReply("That ticket type is invalid. Please use the current ticket panel.");
      return;
    }
    const config = this.store.getTicketConfig(interaction.guild.id);
    const category = config.categoryId
      ? interaction.guild.channels.cache.get(config.categoryId) ?? await interaction.guild.channels.fetch(config.categoryId).catch(() => null)
      : null;
    if (!category || category.type !== ChannelType.GuildCategory) {
      await interaction.editReply("The ticket category is missing. Please ask an administrator to run `/ticket-channel` again.");
      return;
    }
    const reservation = this.store.createTicket({
      guildId: interaction.guild.id,
      creatorId: interaction.user.id,
      type,
    });
    if (!reservation.created) {
      const existing = reservation.ticket?.channelId ? `<#${reservation.ticket.channelId}>` : "your ticket being created";
      await interaction.editReply(`You already have an open **${details.name}** ticket: ${existing}.`);
      return;
    }

    let channel;
    try {
      channel = await interaction.guild.channels.create({
        name: `${details.prefix}-${ticketNumber(reservation.ticket.id)}`,
        type: ChannelType.GuildText,
        parent: category.id,
        topic: `Sofra Ticket #${ticketNumber(reservation.ticket.id)} • ${details.name} • Creator ${interaction.user.id}`,
        permissionOverwrites: [
          { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: interaction.user.id, allow: STAFF_PERMISSION_NAMES },
          ...config.staffRoleIds.map((roleId) => ({ id: roleId, allow: STAFF_PERMISSION_NAMES })),
          {
            id: this.client.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.EmbedLinks,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.ManageChannels,
            ],
          },
        ],
        reason: `Sofra ticket #${ticketNumber(reservation.ticket.id)} created by ${interaction.user.tag}`,
      });
      let ticket = this.store.activateTicket(interaction.guild.id, reservation.ticket.id, channel.id);
      if (!ticket) throw new Error("Ticket reservation could not be activated.");
      const controlMessage = await channel.send({
        content: `<@${interaction.user.id}>`,
        embeds: [buildTicketInformation(ticket)],
        components: ticketControls(ticket),
        allowedMentions: { users: [interaction.user.id], roles: [], parse: [] },
      });
      ticket = this.store.setTicketControlMessage(interaction.guild.id, ticket.id, controlMessage.id);
      await this.modLogService.logTicketEvent(interaction.guild, {
        event: "created",
        ticket,
        channel,
        timestamp: ticket.createdAt,
      });
      await interaction.editReply(`🩷 Your private **${details.name}** ticket is ready: ${channel}`);
    } catch (error) {
      this.store.deleteTicket(interaction.guild.id, reservation.ticket.id);
      if (channel) await channel.delete("Rolling back an incomplete Sofra ticket").catch(() => undefined);
      throw error;
    }
  }

  isStaff(interaction) {
    if (interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) return true;
    const config = this.store.getTicketConfig(interaction.guild.id);
    return config.staffRoleIds.some((roleId) => interaction.member?.roles?.cache?.has(roleId));
  }

  async claim(interaction, ticket) {
    if (ticket.claimedBy) {
      await interaction.editReply(
        ticket.claimedBy === interaction.user.id
          ? "You already claimed this ticket."
          : `This ticket is already claimed by <@${ticket.claimedBy}>.`,
      );
      return;
    }
    const updated = this.store.claimTicket(interaction.guild.id, ticket.id, interaction.user.id);
    await this.refreshControlMessage(interaction.channel, updated);
    await this.modLogService.logTicketEvent(interaction.guild, {
      event: "claimed", ticket: updated, actor: interaction.user, channel: interaction.channel,
    });
    await interaction.editReply(`👤 Ticket **#${ticketNumber(ticket.id)}** is now claimed by you.`);
  }

  async close(interaction, ticket) {
    if (ticket.status !== "open") {
      await interaction.editReply("This ticket is already closed.");
      return;
    }
    await interaction.channel.permissionOverwrites.edit(ticket.creatorId, { SendMessages: false }, { reason: `Ticket closed by ${interaction.user.tag}` });
    const updated = this.store.closeTicket(interaction.guild.id, ticket.id, interaction.user.id);
    await this.refreshControlMessage(interaction.channel, updated);
    await this.modLogService.logTicketEvent(interaction.guild, {
      event: "closed", ticket: updated, actor: interaction.user, channel: interaction.channel,
    });
    await interaction.editReply(`🔒 Ticket **#${ticketNumber(ticket.id)}** is closed. It was not deleted.`);
  }

  async reopen(interaction, ticket) {
    if (ticket.status !== "closed") {
      await interaction.editReply("This ticket is already open.");
      return;
    }
    const updated = this.store.reopenTicket(interaction.guild.id, ticket.id);
    if (!updated) {
      await interaction.editReply("This ticket cannot be reopened because its creator already has another open ticket of the same type.");
      return;
    }
    await interaction.channel.permissionOverwrites.edit(ticket.creatorId, { SendMessages: true }, { reason: `Ticket reopened by ${interaction.user.tag}` });
    await this.refreshControlMessage(interaction.channel, updated);
    await this.modLogService.logTicketEvent(interaction.guild, {
      event: "reopened", ticket: updated, actor: interaction.user, channel: interaction.channel,
    });
    await interaction.editReply(`🔓 Ticket **#${ticketNumber(ticket.id)}** is open again.`);
  }

  async confirmDelete(interaction, ticket) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("ticket:delete-confirm").setLabel("Yes, delete permanently").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("ticket:delete-cancel").setLabel("Cancel").setStyle(ButtonStyle.Secondary),
    );
    await interaction.editReply({
      content: `Delete ticket **#${ticketNumber(ticket.id)}** and its entire channel permanently? This cannot be undone.`,
      components: [row],
    });
  }

  async delete(interaction, ticket) {
    const deleted = this.store.deleteTicket(interaction.guild.id, ticket.id);
    await this.modLogService.logTicketEvent(interaction.guild, {
      event: "deleted", ticket: deleted, actor: interaction.user, channel: interaction.channel,
    });
    await interaction.editReply(`🗑️ Deleting ticket **#${ticketNumber(ticket.id)}** now.`);
    await interaction.channel.delete(`Ticket #${ticketNumber(ticket.id)} deleted by ${interaction.user.tag}`);
  }

  async refreshControlMessage(channel, ticket) {
    if (!ticket?.controlMessageId || !channel?.messages?.fetch) return;
    const message = await channel.messages.fetch(ticket.controlMessageId).catch(() => null);
    if (!message) return;
    await message.edit({ embeds: [buildTicketInformation(ticket)], components: ticketControls(ticket) });
  }

  async handleChannelDelete(channel) {
    if (!channel.guild || !this.store.getHealth().ok) return;
    try {
      const ticket = this.store.getTicketByChannel(channel.guild.id, channel.id);
      if (!ticket || ticket.status === "deleted") return;
      const deleted = this.store.deleteTicket(channel.guild.id, ticket.id);
      await this.modLogService.logTicketEvent(channel.guild, {
        event: "deleted", ticket: deleted, channel,
      });
    } catch (error) {
      this.logger.error("TICKET_CHANNEL_DELETE_FAILED", "A manually deleted ticket could not be recorded.", error, {
        guildId: channel.guild.id,
        channelId: channel.id,
      });
    }
  }

  async failureReply(interaction) {
    const message = "Sofra couldn't complete that ticket action. Nothing else crashed—check permissions, storage, and the Wispbyte console.";
    if (interaction.deferred || interaction.replied) await interaction.editReply({ content: message, components: [] }).catch(() => undefined);
    else await interaction.reply({ content: message, flags: MessageFlags.Ephemeral }).catch(() => undefined);
  }
}
