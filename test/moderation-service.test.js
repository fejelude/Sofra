import test from "node:test";
import assert from "node:assert/strict";
import { PermissionsBitField, PermissionFlagsBits } from "discord.js";
import { ModerationService } from "../src/moderation/service.js";

const GUILD_ID = "1540617362477162506";
const BOT_ID = "1540628204333703198";
const MODERATOR_ID = "1540628204333703199";
const MEMBER_ID = "1540628204333703200";
const CHANNEL_ID = "1540628204333703201";

function fixture() {
  const logs = [];
  const logger = {
    info: (...args) => logs.push(["info", ...args]),
    warn: (...args) => logs.push(["warn", ...args]),
    error: (...args) => logs.push(["error", ...args]),
  };
  const botMember = {
    id: BOT_ID,
    permissions: new PermissionsBitField(PermissionFlagsBits.Administrator),
    roles: { highest: { comparePositionTo: () => 1 } },
  };
  const actor = {
    id: MODERATOR_ID,
    roles: { highest: { comparePositionTo: () => 1 } },
  };
  let dms = 0;
  const user = {
    id: MEMBER_ID,
    tag: "Member#0001",
    username: "Member",
    bot: false,
    send: async () => {
      dms += 1;
    },
  };
  const member = {
    id: MEMBER_ID,
    user,
    roles: { highest: { id: "1540628204333703202" } },
    kickable: true,
    bannable: true,
    moderatable: true,
    timeout: async () => {},
    kick: async () => {},
  };
  const everyone = { id: GUILD_ID };
  const guild = {
    id: GUILD_ID,
    name: "Sofra Garden",
    ownerId: "1540628204333703299",
    roles: { everyone },
    members: {
      me: botMember,
      fetch: async (id) => {
        if (id === BOT_ID) return botMember;
        if (id === MODERATOR_ID) return actor;
        if (id === MEMBER_ID) return member;
        throw new Error("Unknown member");
      },
    },
  };
  let warningTotal = 0;
  let lockdown = null;
  const store = {
    getHealth: () => ({ ok: true, message: "ready" }),
    addWarning: ({ reason }) => ({ total: ++warningTotal, reason }),
    getWarnings: () => ({ total: warningTotal, history: [] }),
    getLockdown: () => lockdown,
    saveLockdown: (value) => {
      if (lockdown) return false;
      lockdown = {
        previousSendMessages: value.previousSendMessages,
        previousSendMessagesInThreads: value.previousSendMessagesInThreads,
        lockedBy: value.lockedBy,
        lockedAt: 1,
      };
      return true;
    },
    removeLockdown: () => {
      const existed = Boolean(lockdown);
      lockdown = null;
      return existed;
    },
  };
  const client = {
    user: {
      id: BOT_ID,
      displayAvatarURL: () => "https://cdn.discordapp.com/embed/avatars/0.png",
    },
  };
  const service = new ModerationService({ client, store, logger });
  return {
    service,
    store,
    guild,
    user,
    member,
    logs,
    dms: () => dms,
    warningTotal: () => warningTotal,
  };
}

function baseInteraction(guild, commandName, options = {}) {
  let reply;
  const interaction = {
    commandName,
    guild,
    guildId: guild.id,
    user: { id: MODERATOR_ID, tag: "Mod#0001" },
    channelId: CHANNEL_ID,
    deferred: true,
    replied: false,
    editReply: async (value) => {
      reply = value;
    },
    options: {
      getUser: (name) => options[name] ?? null,
      getString: (name) => options[name] ?? null,
      getInteger: (name) => options[name] ?? null,
      getChannel: (name) => options[name] ?? null,
    },
  };
  return { interaction, reply: () => reply };
}

test("warn persists the offense and sends an aesthetic private DM", async () => {
  const current = fixture();
  const { interaction, reply } = baseInteraction(current.guild, "warn", {
    member: current.user,
    reason: "Repeated flooding",
  });

  await current.service.warn(interaction);

  assert.equal(current.warningTotal(), 1);
  assert.equal(current.dms(), 1);
  assert.match(reply(), /Total offenses: \*\*1\*\*/);
});

test("purge all is bounded and stops after the final partial batch", async () => {
  const current = fixture();
  const batches = [100, 100, 30];
  let calls = 0;
  const channel = {
    bulkDelete: async () => ({ size: batches[calls++] }),
    permissionsFor: () =>
      new PermissionsBitField(
        PermissionFlagsBits.ViewChannel |
          PermissionFlagsBits.ReadMessageHistory |
          PermissionFlagsBits.ManageMessages,
      ),
  };
  const { interaction, reply } = baseInteraction(current.guild, "purge", {
    messages: "all",
  });
  interaction.channel = channel;

  await current.service.purge(interaction);

  assert.equal(calls, 3);
  assert.match(reply(), /230/);
  assert.match(reply(), /14 days/);
});

test("lockdown and unlock restore the exact prior Send Messages state", async () => {
  const current = fixture();
  const edits = [];
  const channel = {
    id: CHANNEL_ID,
    guildId: GUILD_ID,
    toString: () => `<#${CHANNEL_ID}>`,
    permissionOverwrites: {
      cache: new Map(),
      edit: async (_role, permissions) => edits.push(permissions),
    },
    permissionsFor: () =>
      new PermissionsBitField(
        PermissionFlagsBits.ManageChannels | PermissionFlagsBits.ManageRoles,
      ),
    setRateLimitPerUser: async () => {},
  };
  const locked = baseInteraction(current.guild, "lockdown", { channel });
  await current.service.lockdown(locked.interaction);
  const unlocked = baseInteraction(current.guild, "unlock", { channel });
  await current.service.unlock(unlocked.interaction);

  assert.deepEqual(edits, [
    { SendMessages: false, SendMessagesInThreads: false },
    { SendMessages: null, SendMessagesInThreads: null },
  ]);
  assert.match(unlocked.reply(), /pre-lockdown state/);
});

test("runtime permission guard rejects unauthorized command calls", async () => {
  const current = fixture();
  let response;
  const interaction = {
    commandName: "ban",
    guild: current.guild,
    guildId: GUILD_ID,
    user: { id: MODERATOR_ID },
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
    options: {},
  };

  await current.service.handleInteraction(interaction);
  assert.match(response, /do not have/);
});

test("role hierarchy prevents moderators from acting on higher members", async () => {
  const current = fixture();
  current.guild.members.fetch = async (id) => {
    if (id === MODERATOR_ID) {
      return { id, roles: { highest: { comparePositionTo: () => -1 } } };
    }
    if (id === BOT_ID) return current.guild.members.me;
    return current.member;
  };
  const { interaction, reply } = baseInteraction(current.guild, "kick", {
    member: current.user,
  });

  await current.service.kick(interaction);
  assert.match(reply(), /equal or higher role/);
});
