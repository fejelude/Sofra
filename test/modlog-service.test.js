import test from "node:test";
import assert from "node:assert/strict";
import {
  AuditLogEvent,
  ChannelType,
  Collection,
  PermissionsBitField,
  PermissionFlagsBits,
} from "discord.js";
import { ModLogService, buildModLogEmbed } from "../src/modlog/service.js";

const GUILD_ID = "1540617362477162506";
const BOT_ID = "1540628204333703198";
const MODERATOR_ID = "1540628204333703199";
const MEMBER_ID = "1540628204333703200";
const CHANNEL_ID = "1540628204333703201";

function fixture() {
  const sent = [];
  const logs = [];
  let config = { guildId: GUILD_ID, enabled: true, channelId: CHANNEL_ID };
  const botMember = {
    permissions: new PermissionsBitField(
      PermissionFlagsBits.ViewAuditLog |
        PermissionFlagsBits.ManageChannels |
        PermissionFlagsBits.ManageRoles,
    ),
  };
  const channel = {
    id: CHANNEL_ID,
    guildId: GUILD_ID,
    type: ChannelType.GuildText,
    send: async (payload) => sent.push(payload),
    permissionsFor: () =>
      new PermissionsBitField(
        PermissionFlagsBits.ViewChannel |
          PermissionFlagsBits.SendMessages |
          PermissionFlagsBits.EmbedLinks,
      ),
    toString: () => `<#${CHANNEL_ID}>`,
  };
  const guild = {
    id: GUILD_ID,
    members: { me: botMember },
    roles: { everyone: { id: GUILD_ID } },
    channels: {
      cache: new Collection([[CHANNEL_ID, channel]]),
      fetch: async (id) => (id === CHANNEL_ID ? channel : null),
    },
  };
  const store = {
    getHealth: () => ({ ok: true, message: "ready" }),
    getModLogConfig: () => config,
    setModLogChannel: (_guildId, channelId) => {
      config = { ...config, channelId };
      return config;
    },
    setModLogEnabled: (_guildId, enabled) => {
      config = { ...config, enabled };
      return config;
    },
    clearModLogChannel: () => {
      config = { ...config, enabled: false, channelId: null };
      return config;
    },
  };
  const logger = {
    info: (...args) => logs.push(["info", ...args]),
    warn: (...args) => logs.push(["warn", ...args]),
    error: (...args) => logs.push(["error", ...args]),
  };
  const client = { user: { id: BOT_ID, username: "Sofra", tag: "Sofra#0986" } };
  return {
    service: new ModLogService({ client, store, logger }),
    guild,
    channel,
    sent,
    logs,
    config: () => config,
  };
}

test("enabled logging sends one aesthetic embed without allowed mentions", async () => {
  const current = fixture();
  const sent = await current.service.logAction(current.guild, {
    action: "warn",
    moderator: { id: MODERATOR_ID, tag: "Moderator#0001" },
    target: { id: MEMBER_ID, tag: "Member#0001" },
    reason: "Repeated flooding",
    details: "Total recorded offenses: 2",
  });

  assert.equal(sent, true);
  assert.equal(current.sent.length, 1);
  assert.deepEqual(current.sent[0].allowedMentions, { parse: [] });
  const json = current.sent[0].embeds[0].toJSON();
  assert.match(json.title, /Official Warning/);
  assert.match(json.fields.find((field) => field.name === "📝 Reason").value, /Repeated flooding/);
});

test("setup creates a private Moderation category and enables staff logs", async () => {
  const current = fixture();
  const created = [];
  const overwrites = [];
  current.guild.channels.cache.clear();
  current.guild.channels.create = async (options) => {
    const isCategory = options.type === ChannelType.GuildCategory;
    const createdChannel = isCategory
      ? {
          id: "1540628204333703210",
          name: options.name,
          type: options.type,
        }
      : {
          ...current.channel,
          parentId: options.parent,
          name: options.name,
          permissionOverwrites: {
            edit: async (target, permissions) =>
              overwrites.push({ target: target.id ?? target, permissions }),
          },
        };
    current.guild.channels.cache.set(createdChannel.id, createdChannel);
    created.push(options);
    return createdChannel;
  };
  let reply;
  await current.service.setup({
    guild: current.guild,
    user: { id: MODERATOR_ID, tag: "Moderator#0001" },
    editReply: async (value) => {
      reply = value;
    },
  });

  assert.equal(created.length, 2);
  assert.equal(created[0].name, "Moderation");
  assert.equal(created[1].name, "staff-logs");
  assert.equal(overwrites[0].permissions.ViewChannel, false);
  assert.equal(overwrites[1].permissions.ViewChannel, true);
  assert.equal(current.config().enabled, true);
  assert.equal(current.sent.length, 1);
  assert.match(reply, /enabled moderation logging/);
});

test("manual Discord audit actions are mirrored while Sofra actions are deduplicated", async () => {
  const current = fixture();
  const entry = {
    action: AuditLogEvent.MemberBanAdd,
    executor: { id: MODERATOR_ID, tag: "Moderator#0001" },
    executorId: MODERATOR_ID,
    target: { id: MEMBER_ID, tag: "Member#0001" },
    targetId: MEMBER_ID,
    reason: "Manual ban",
    createdTimestamp: 10_000,
    changes: [],
  };

  await current.service.handleAuditLogEntry(entry, current.guild);
  await current.service.handleAuditLogEntry(
    { ...entry, executorId: BOT_ID },
    current.guild,
  );

  assert.equal(current.sent.length, 1);
  assert.match(current.sent[0].embeds[0].toJSON().title, /Member Banned/);
});

test("manual timeout audit entries are recognized precisely", () => {
  const current = fixture();
  const payload = current.service.auditPayload({
    action: AuditLogEvent.MemberUpdate,
    executorId: MODERATOR_ID,
    targetId: MEMBER_ID,
    changes: [
      {
        key: "communication_disabled_until",
        old: null,
        new: "2026-08-24T00:00:00.000Z",
      },
    ],
  });
  assert.equal(payload.action, "timeout");
  assert.match(payload.details, /Timeout until/);
});

test("deleting the configured channel disables and clears logging", async () => {
  const current = fixture();
  current.channel.guild = current.guild;
  await current.service.handleChannelDelete(current.channel);
  assert.deepEqual(current.config(), {
    guildId: GUILD_ID,
    enabled: false,
    channelId: null,
  });
});

test("log embeds neutralize markdown and mention-like reason content", () => {
  const json = buildModLogEmbed({
    action: "warn",
    moderatorId: MODERATOR_ID,
    targetId: MEMBER_ID,
    reason: "@everyone **test**",
  }).toJSON();
  const reason = json.fields.find((field) => field.name === "📝 Reason").value;
  assert.doesNotMatch(reason, /@everyone/);
  assert.match(reason, /\\\*\\\*test\\\*\\\*/);
});
