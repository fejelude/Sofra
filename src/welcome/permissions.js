import { ChannelType, PermissionFlagsBits } from "discord.js";

const SUPPORTED_CHANNEL_TYPES = new Set([
  ChannelType.GuildText,
  ChannelType.GuildAnnouncement,
]);

export function isSupportedWelcomeChannel(channel) {
  return Boolean(
    channel &&
      SUPPORTED_CHANNEL_TYPES.has(channel.type) &&
      typeof channel.send === "function",
  );
}

export async function inspectWelcomeChannel({
  guild,
  channelId,
  clientUserId,
}) {
  const result = {
    channel: null,
    exists: false,
    supportedType: false,
    viewChannel: false,
    sendMessages: false,
    embedLinks: false,
    valid: false,
    reason: "No welcome channel is configured.",
  };

  if (!channelId) {
    return result;
  }

  let channel;
  try {
    channel = guild.channels.cache.get(channelId) ?? (await guild.channels.fetch(channelId));
  } catch {
    return {
      ...result,
      reason: "The configured channel is missing or Sofra cannot access it.",
    };
  }

  if (!channel || channel.guildId !== guild.id) {
    return {
      ...result,
      reason: "The configured channel no longer exists in this server.",
    };
  }

  const supportedType = isSupportedWelcomeChannel(channel);
  if (!supportedType) {
    return {
      ...result,
      channel,
      exists: true,
      reason: "The configured channel is not a supported text or announcement channel.",
    };
  }

  let botMember = guild.members.me;
  if (!botMember) {
    try {
      botMember = await guild.members.fetch(clientUserId);
    } catch {
      return {
        ...result,
        channel,
        exists: true,
        supportedType: true,
        reason: "Sofra could not resolve her server membership to check permissions.",
      };
    }
  }

  const permissions = channel.permissionsFor(botMember);
  if (!permissions) {
    return {
      ...result,
      channel,
      exists: true,
      supportedType: true,
      reason: "Discord did not return channel permissions for Sofra.",
    };
  }

  const viewChannel = permissions.has(PermissionFlagsBits.ViewChannel);
  const sendMessages = permissions.has(PermissionFlagsBits.SendMessages);
  const embedLinks = permissions.has(PermissionFlagsBits.EmbedLinks);
  const valid = viewChannel && sendMessages && embedLinks;

  return {
    channel,
    exists: true,
    supportedType: true,
    viewChannel,
    sendMessages,
    embedLinks,
    valid,
    reason: valid
      ? "The welcome channel is ready."
      : "Sofra is missing one or more required channel permissions.",
  };
}
