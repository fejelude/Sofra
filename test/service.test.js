import test from "node:test";
import assert from "node:assert/strict";
import { WelcomeService } from "../src/welcome/service.js";

const GUILD_ID = "123456789012345678";
const CHANNEL_ID = "223456789012345678";
const MEMBER_ID = "323456789012345678";

function serviceFixture() {
  const logEntries = [];
  const logger = {
    info: (...args) => logEntries.push(["info", ...args]),
    warn: (...args) => logEntries.push(["warn", ...args]),
    error: (...args) => logEntries.push(["error", ...args]),
  };
  const store = {
    getGuildConfig: () => ({ enabled: true, channelId: CHANNEL_ID, randomMessages: true }),
  };
  const client = {
    user: {
      id: "423456789012345678",
      displayAvatarURL: () => "https://cdn.discordapp.com/embed/avatars/1.png",
    },
  };
  const member = {
    id: MEMBER_ID,
    user: { username: "Ada" },
    displayAvatarURL: () => "https://cdn.discordapp.com/embed/avatars/0.png",
    guild: {
      id: GUILD_ID,
      name: "Sofra Test",
      memberCount: 10,
      iconURL: () => null,
    },
  };
  const channel = { id: CHANNEL_ID };
  const service = new WelcomeService({ client, store, logger });
  service.inspect = async () => ({ valid: true, channel, reason: "ready" });

  return { service, member, channel, logEntries };
}

test("duplicate join events send only one welcome", async () => {
  const { service, member } = serviceFixture();
  let sends = 0;
  let releaseFirstSend;
  const firstSend = new Promise((resolve) => {
    releaseFirstSend = resolve;
  });

  service.sendWelcome = async () => {
    sends += 1;
    await firstSend;
  };

  const first = service.handleMemberJoin(member);
  const duplicate = service.handleMemberJoin(member);
  releaseFirstSend();
  await Promise.all([first, duplicate]);
  await service.handleMemberJoin(member);

  assert.equal(sends, 1);
});

test("a failed send is logged and can be retried", async () => {
  const { service, member, logEntries } = serviceFixture();
  let attempts = 0;

  service.sendWelcome = async () => {
    attempts += 1;
    if (attempts === 1) throw new Error("temporary Discord failure");
  };

  await service.handleMemberJoin(member);
  await service.handleMemberJoin(member);

  assert.equal(attempts, 2);
  assert.ok(logEntries.some(([level, event]) => level === "error" && event === "WELCOME_SEND_FAILED"));
});

test("an invalid configuration skips safely without sending", async () => {
  const { service, member, logEntries } = serviceFixture();
  let sends = 0;
  service.inspect = async () => ({ valid: false, channel: null, reason: "deleted" });
  service.sendWelcome = async () => {
    sends += 1;
  };

  await service.handleMemberJoin(member);

  assert.equal(sends, 0);
  assert.ok(
    logEntries.some(
      ([level, event]) => level === "warn" && event === "WELCOME_SKIPPED_INVALID_CONFIG",
    ),
  );
});

test("runtime permission guard blocks non-admin configuration attempts", async () => {
  const { service } = serviceFixture();
  let response;
  const interaction = {
    commandName: "welcome",
    guildId: GUILD_ID,
    guild: { id: GUILD_ID },
    user: { id: MEMBER_ID },
    deferred: false,
    replied: false,
    isChatInputCommand: () => true,
    inGuild: () => true,
    deferReply: async () => {
      interaction.deferred = true;
    },
    editReply: async (value) => {
      response = value;
    },
    memberPermissions: { has: () => false },
    options: { getSubcommand: () => "disable" },
  };

  await service.handleInteraction(interaction);

  assert.match(response, /Manage Server/);
});

test("random welcome mode ignores saved fixed message and description overrides", async () => {
  const { service, member } = serviceFixture();
  let payload;
  const channel = {
    send: async (value) => {
      payload = value;
    },
  };

  await service.sendWelcome(member, channel, {
    randomMessages: true,
    messageTemplate: "THIS FIXED MESSAGE MUST NOT BE USED",
    embedDescription: "THIS FIXED DESCRIPTION MUST NOT BE USED",
  });

  const embed = payload.embeds[0].toJSON();
  assert.doesNotMatch(embed.description, /THIS FIXED MESSAGE MUST NOT BE USED/);
  assert.doesNotMatch(embed.description, /THIS FIXED DESCRIPTION MUST NOT BE USED/);
});

test("custom welcome mode uses the configured fixed message", async () => {
  const { service, member } = serviceFixture();
  let payload;
  const channel = {
    send: async (value) => {
      payload = value;
    },
  };

  await service.sendWelcome(member, channel, {
    randomMessages: false,
    messageTemplate: "Hello {user.mention}, this is the fixed dashboard message ♡",
  });

  const embed = payload.embeds[0].toJSON();
  assert.match(embed.description, /fixed dashboard message/);
});

test("status reports every requested health and permission check", async () => {
  const { service } = serviceFixture();
  service.store.getHealth = () => ({
    ok: true,
    message: "Configuration storage is ready.",
  });
  service.inspect = async () => ({
    channel: { id: CHANNEL_ID },
    exists: true,
    supportedType: true,
    viewChannel: true,
    sendMessages: true,
    embedLinks: true,
    valid: true,
    reason: "The welcome channel is ready.",
  });

  let reply;
  const interaction = {
    guild: { id: GUILD_ID },
    editReply: async (value) => {
      reply = value;
    },
  };

  await service.status(interaction);
  const embed = reply.embeds[0].toJSON();
  const fieldNames = embed.fields.map((field) => field.name);

  assert.deepEqual(fieldNames, [
    "🎀 System",
    "💌 Message Mode",
    "🌸 Channel",
    "☁️ Channel Exists",
    "👁️ View Channel",
    "💌 Send Messages",
    "✨ Embed Links",
    "✦ Configuration Valid",
    "🫧 Storage",
  ]);
});
