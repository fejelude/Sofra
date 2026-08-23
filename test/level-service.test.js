import test from "node:test";
import assert from "node:assert/strict";
import { LevelService } from "../src/level/service.js";

const GUILD_ID = "1540617362477162506";
const MEMBER_ID = "1540628204333703198";
const MESSAGE_ID = "1540628204333703199";

function fixture() {
  const entries = [];
  const logger = {
    info: (...args) => entries.push(["info", ...args]),
    warn: (...args) => entries.push(["warn", ...args]),
    error: (...args) => entries.push(["error", ...args]),
  };
  let awards = 0;
  const config = {
    enabled: true,
    notificationChannelId: null,
    xpMin: 20,
    xpMax: 20,
    cooldownSeconds: 60,
  };
  const store = {
    getHealth: () => ({ ok: true, message: "ready" }),
    getConfig: () => config,
    awardMessageXp: () => {
      awards += 1;
      return { awarded: true, previousXp: 99, newXp: 119 };
    },
    listRoleRewards: () => [],
  };
  const client = {
    user: {
      id: "1540628204333703298",
      displayAvatarURL: () => "https://cdn.discordapp.com/embed/avatars/0.png",
    },
  };
  const member = {
    id: MEMBER_ID,
    client,
    roles: { cache: new Map(), add: async () => {} },
    displayAvatarURL: () => "https://cdn.discordapp.com/embed/avatars/0.png",
  };
  const guild = {
    id: GUILD_ID,
    members: { me: null, fetch: async () => member },
    roles: { cache: new Map(), fetch: async () => null },
  };
  member.guild = guild;
  const message = {
    id: MESSAGE_ID,
    guildId: GUILD_ID,
    channelId: "1540628204333703200",
    guild,
    channel: { id: "1540628204333703200" },
    author: { id: MEMBER_ID, bot: false },
    member,
    webhookId: null,
    system: false,
    createdTimestamp: 100_000,
    inGuild: () => true,
  };
  Object.defineProperty(message, "content", {
    get() {
      throw new Error("message content must never be read");
    },
  });

  const service = new LevelService({ client, store, logger });
  return { service, store, config, message, entries, getAwards: () => awards };
}

test("eligible messages earn XP without reading message content", async () => {
  const { service, message, getAwards } = fixture();
  let notifications = 0;
  service.sendLevelUpNotification = async () => {
    notifications += 1;
  };

  await service.handleMessage(message);

  assert.equal(getAwards(), 1);
  assert.equal(notifications, 1);
});

test("duplicate events and bot messages are ignored safely", async () => {
  const { service, message, getAwards } = fixture();
  service.sendLevelUpNotification = async () => {};

  await service.handleMessage(message);
  await service.handleMessage(message);
  await service.handleMessage({
    ...message,
    id: "1540628204333703201",
    author: { id: MEMBER_ID, bot: true },
  });

  assert.equal(getAwards(), 1);
});

test("runtime guard blocks non-admin configuration but public rank stays public", async () => {
  const { service } = fixture();
  let adminResponse;
  const adminInteraction = {
    commandName: "level",
    guildId: GUILD_ID,
    guild: { id: GUILD_ID },
    user: { id: MEMBER_ID },
    deferred: false,
    replied: false,
    isChatInputCommand: () => true,
    inGuild: () => true,
    deferReply: async (options) => {
      adminInteraction.deferred = true;
      assert.ok(options.flags);
    },
    editReply: async (value) => {
      adminResponse = value;
    },
    memberPermissions: { has: () => false },
    options: { getSubcommand: () => "disable" },
  };
  await service.handleInteraction(adminInteraction);
  assert.match(adminResponse, /Manage Server/);

  let publicDeferred = false;
  service.rank = async () => {};
  const publicInteraction = {
    ...adminInteraction,
    deferred: false,
    deferReply: async (...args) => {
      publicDeferred = args.length === 0;
    },
    options: { getSubcommand: () => "rank" },
  };
  await service.handleInteraction(publicInteraction);
  assert.equal(publicDeferred, true);
});

test("database failures are logged and never escape the event handler", async () => {
  const { service, store, message, entries } = fixture();
  store.awardMessageXp = () => {
    throw new Error("database busy");
  };

  await assert.doesNotReject(service.handleMessage(message));
  assert.ok(entries.some(([level, event]) => level === "error" && event === "LEVEL_MESSAGE_FAILED"));
});
