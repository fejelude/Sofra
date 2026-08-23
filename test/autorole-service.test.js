import test from "node:test";
import assert from "node:assert/strict";
import { PermissionsBitField, PermissionFlagsBits } from "discord.js";
import { AutoRoleService } from "../src/autorole/service.js";

const GUILD_ID = "1540617362477162506";
const BOT_ID = "1540628204333703198";
const MEMBER_ID = "1540628204333703199";
const ROLE_ID = "1540628204333703200";

function fixture() {
  const logs = [];
  const logger = {
    info: (...args) => logs.push(["info", ...args]),
    warn: (...args) => logs.push(["warn", ...args]),
    error: (...args) => logs.push(["error", ...args]),
  };
  const role = { id: ROLE_ID, managed: false, guild: null };
  const botMember = {
    id: BOT_ID,
    permissions: new PermissionsBitField(PermissionFlagsBits.ManageRoles),
    roles: { highest: { comparePositionTo: () => 1 } },
  };
  const guild = {
    id: GUILD_ID,
    roles: {
      cache: new Map([[ROLE_ID, role]]),
      fetch: async () => role,
    },
    members: { me: botMember, fetch: async () => botMember },
  };
  role.guild = guild;
  let assignments = 0;
  const member = {
    id: MEMBER_ID,
    user: { bot: false },
    guild,
    roles: {
      cache: new Map(),
      add: async () => {
        assignments += 1;
      },
    },
  };
  const store = {
    getHealth: () => ({ ok: true, message: "ready" }),
    getAutoRoleConfig: () => ({ enabled: true, roleId: ROLE_ID }),
    clearAutoRole() {},
  };
  const client = { user: { id: BOT_ID, displayAvatarURL: () => "https://example.com/bot.png" } };
  const service = new AutoRoleService({ client, store, logger });
  return { service, store, member, role, logs, assignments: () => assignments };
}

test("new human members receive the configured role exactly once", async () => {
  const { service, member, assignments, logs } = fixture();
  let release;
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  member.roles.add = async () => {
    await pending;
  };

  const first = service.handleMemberJoin(member);
  const duplicate = service.handleMemberJoin(member);
  release();
  await Promise.all([first, duplicate]);

  assert.equal(logs.filter(([level, event]) => level === "info" && event === "AUTOROLE_ASSIGNED").length, 1);
  assert.equal(assignments(), 0);
});

test("disabled configurations, bots, and existing roles are ignored", async () => {
  const disabled = fixture();
  disabled.store.getAutoRoleConfig = () => ({ enabled: false, roleId: ROLE_ID });
  await disabled.service.handleMemberJoin(disabled.member);
  assert.equal(disabled.assignments(), 0);

  const bot = fixture();
  bot.member.user.bot = true;
  await bot.service.handleMemberJoin(bot.member);
  assert.equal(bot.assignments(), 0);

  const existing = fixture();
  existing.member.roles.cache.set(ROLE_ID, existing.role);
  await existing.service.handleMemberJoin(existing.member);
  assert.equal(existing.assignments(), 0);
});

test("assignment failures are logged and never escape the join handler", async () => {
  const { service, member, logs } = fixture();
  member.roles.add = async () => {
    throw new Error("Discord rejected role");
  };

  await assert.doesNotReject(service.handleMemberJoin(member));
  assert.ok(logs.some(([level, event]) => level === "error" && event === "AUTOROLE_ASSIGN_FAILED"));
});

test("deleting the configured role clears and disables it", () => {
  const { service, store, role, logs } = fixture();
  let cleared = false;
  store.clearAutoRole = () => {
    cleared = true;
  };

  service.handleRoleDelete(role);

  assert.equal(cleared, true);
  assert.ok(logs.some(([level, event]) => level === "warn" && event === "AUTOROLE_CONFIG_CLEARED"));
});

test("runtime permission guard blocks non-admin command attempts", async () => {
  const { service } = fixture();
  let response;
  const interaction = {
    commandName: "autorole",
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
