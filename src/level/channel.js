import { ChannelType, PermissionFlagsBits } from "discord.js";

const CONFIGURABLE_CHANNEL_TYPES = new Set([
  ChannelType.GuildText,
  ChannelType.GuildAnnouncement,
]);

const THREAD_CHANNEL_TYPES = new Set([
  ChannelType.PublicThread,
  ChannelType.PrivateThread,
  ChannelType.AnnouncementThread,
]);

export function isConfigurableLevelChannel(channel) {
  return Boolean(
    channel &&
      CONFIGURABLE_CHANNEL_TYPES.has(channel.type) &&
      typeof channel.send === "function",
  );
}

export function isLevelNotificationChannel(channel) {
  return Boolean(
    channel &&
      (CONFIGURABLE_CHANNEL_TYPES.has(channel.type) ||
        THREAD_CHANNEL_TYPES.has(channel.type)) &&
      typeof channel.send === "function",
  );
}

export async function inspectLevelChannelObject({ guild, channel, clientUserId }) {
  const base = {
    channel: channel ?? null,
    exists: Boolean(channel),
    supportedType: false,
    viewChannel: false,
    sendMessages: false,
    embedLinks: false,
    valid: false,
    reason: "The notification channel is missing.",
  };

  if (!channel || channel.guildId !== guild.id) {
    return base;
  }

  if (!isLevelNotificationChannel(channel)) {
    return {
      ...base,
      reason: "The notification destination is not a supported text channel.",
    };
  }

  let botMember = guild.members.me;
  if (!botMember) {
    try {
      botMember = await guild.members.fetch(clientUserId);
    } catch {
      return {
        ...base,
        supportedType: true,
        reason: "Sofra could not resolve her server membership to check permissions.",
      };
    }
  }

  const permissions = channel.permissionsFor(botMember);
  if (!permissions) {
    return {
      ...base,
      supportedType: true,
      reason: "Discord did not return channel permissions for Sofra.",
    };
  }

  const sendPermission = THREAD_CHANNEL_TYPES.has(channel.type)
    ? PermissionFlagsBits.SendMessagesInThreads
    : PermissionFlagsBits.SendMessages;
  const viewChannel = permissions.has(PermissionFlagsBits.ViewChannel);
  const sendMessages = permissions.has(sendPermission);
  const embedLinks = permissions.has(PermissionFlagsBits.EmbedLinks);
  const valid = viewChannel && sendMessages && embedLinks;

  return {
    ...base,
    supportedType: true,
    viewChannel,
    sendMessages,
    embedLinks,
    valid,
    reason: valid
      ? "The notification channel is ready."
      : "Sofra is missing one or more notification permissions.",
  };
}

export async function inspectLevelChannel({ guild, channelId, clientUserId }) {
  if (!channelId) {
    return {
      channel: null,
      exists: false,
      supportedType: false,
      viewChannel: false,
      sendMessages: false,
      embedLinks: false,
      valid: false,
      reason: "No dedicated notification channel is configured.",
    };
  }

  let channel;
  try {
    channel = guild.channels.cache.get(channelId) ?? (await guild.channels.fetch(channelId));
  } catch {
    channel = null;
  }

  if (!channel) {
    return {
      channel: null,
      exists: false,
      supportedType: false,
      viewChannel: false,
      sendMessages: false,
      embedLinks: false,
      valid: false,
      reason: "The configured notification channel is missing or inaccessible.",
    };
  }

  return inspectLevelChannelObject({ guild, channel, clientUserId });
}
