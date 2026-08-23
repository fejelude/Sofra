import test from "node:test";
import assert from "node:assert/strict";
import { PermissionsBitField, PermissionFlagsBits } from "discord.js";
import {
  grantEligibleRoleRewards,
  inspectRewardRole,
} from "../src/level/roles.js";

const GUILD_ID = "1540617362477162506";
const BOT_ID = "1540628204333703198";
const ADMIN_ID = "1540628204333703199";
const MEMBER_ID = "1540628204333703200";
const ROLE_ID = "1540628204333703201";

function fixture({ manageRoles = true, botAbove = true, actorAbove = true } = {}) {
  const role = { id: ROLE_ID, guild: null, managed: false };
  const botMember = {
    id: BOT_ID,
    permissions: new PermissionsBitField(
      manageRoles ? PermissionFlagsBits.ManageRoles : 0n,
    ),
    roles: { highest: { comparePositionTo: () => (botAbove ? 1 : -1) } },
  };
  const actorMember = {
    id: ADMIN_ID,
    roles: { highest: { comparePositionTo: () => (actorAbove ? 1 : -1) } },
  };
  const guild = {
    id: GUILD_ID,
    ownerId: "1540628204333703299",
    members: {
      me: botMember,
      fetch: async (id) => (id === BOT_ID ? botMember : actorMember),
    },
    roles: {
      cache: new Map([[ROLE_ID, role]]),
      fetch: async () => role,
    },
  };
  role.guild = guild;
  return { guild, role, botMember };
}

test("reward role validation enforces permissions and both role hierarchies", async () => {
  const valid = fixture();
  assert.equal(
    (await inspectRewardRole({
      guild: valid.guild,
      role: valid.role,
      actorId: ADMIN_ID,
      clientUserId: BOT_ID,
    })).valid,
    true,
  );

  for (const [options, message] of [
    [{ manageRoles: false }, /Manage Roles/],
    [{ botAbove: false }, /Sofra’s highest role/],
    [{ actorAbove: false }, /your highest role/],
  ]) {
    const current = fixture(options);
    const result = await inspectRewardRole({
      guild: current.guild,
      role: current.role,
      actorId: ADMIN_ID,
      clientUserId: BOT_ID,
    });
    assert.equal(result.valid, false);
    assert.match(result.reason, message);
  }
});

test("managed roles and @everyone can never be rewards", async () => {
  const managed = fixture();
  managed.role.managed = true;
  assert.equal(
    (await inspectRewardRole({
      guild: managed.guild,
      role: managed.role,
      actorId: ADMIN_ID,
      clientUserId: BOT_ID,
    })).valid,
    false,
  );

  const everyone = fixture();
  everyone.role.id = GUILD_ID;
  assert.equal(
    (await inspectRewardRole({
      guild: everyone.guild,
      role: everyone.role,
      actorId: ADMIN_ID,
      clientUserId: BOT_ID,
    })).valid,
    false,
  );
});

test("eligible cumulative roles are assigned once and existing roles are skipped", async () => {
  const { guild, role } = fixture();
  const existingRoleId = "1540628204333703202";
  const tooHighRoleId = "1540628204333703203";
  const existingRole = { id: existingRoleId, guild, managed: false };
  guild.roles.cache.set(existingRoleId, existingRole);
  let added;
  const member = {
    id: MEMBER_ID,
    guild,
    client: { user: { id: BOT_ID } },
    roles: {
      cache: new Map([[existingRoleId, existingRole]]),
      add: async (roles) => {
        added = roles;
      },
    },
  };
  const logger = { warn() {}, error() {} };

  const assigned = await grantEligibleRoleRewards({
    member,
    rewards: [
      { roleId: existingRoleId, requiredLevel: 1 },
      { roleId: ROLE_ID, requiredLevel: 2 },
      { roleId: tooHighRoleId, requiredLevel: 10 },
    ],
    level: 3,
    logger,
  });

  assert.deepEqual(assigned, [role]);
  assert.deepEqual(added, [role]);
});
