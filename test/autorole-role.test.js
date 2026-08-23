import test from "node:test";
import assert from "node:assert/strict";
import { PermissionsBitField, PermissionFlagsBits } from "discord.js";
import { inspectAutoRole } from "../src/autorole/role.js";

const GUILD_ID = "1540617362477162506";
const BOT_ID = "1540628204333703198";
const ADMIN_ID = "1540628204333703199";
const ROLE_ID = "1540628204333703200";

function fixture({ manageRoles = true, botAbove = true, actorAbove = true } = {}) {
  const role = { id: ROLE_ID, managed: false, guild: null };
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
  };
  role.guild = guild;
  return { guild, role };
}

test("auto-role validation accepts a manageable server role", async () => {
  const { guild, role } = fixture();
  const result = await inspectAutoRole({
    guild,
    role,
    clientUserId: BOT_ID,
    actorId: ADMIN_ID,
  });

  assert.equal(result.exists, true);
  assert.equal(result.manageRoles, true);
  assert.equal(result.botAboveRole, true);
  assert.equal(result.actorAboveRole, true);
  assert.equal(result.valid, true);
});

test("auto-role validation rejects missing permission and hierarchy failures", async () => {
  for (const [options, reason] of [
    [{ manageRoles: false }, /Manage Roles/],
    [{ botAbove: false }, /Sofra’s highest role/],
    [{ actorAbove: false }, /your highest role/],
  ]) {
    const { guild, role } = fixture(options);
    const result = await inspectAutoRole({
      guild,
      role,
      clientUserId: BOT_ID,
      actorId: ADMIN_ID,
    });
    assert.equal(result.valid, false);
    assert.match(result.reason, reason);
  }
});

test("@everyone and managed roles cannot be configured", async () => {
  const everyone = fixture();
  everyone.role.id = GUILD_ID;
  assert.equal(
    (await inspectAutoRole({
      guild: everyone.guild,
      role: everyone.role,
      clientUserId: BOT_ID,
    })).valid,
    false,
  );

  const managed = fixture();
  managed.role.managed = true;
  assert.equal(
    (await inspectAutoRole({
      guild: managed.guild,
      role: managed.role,
      clientUserId: BOT_ID,
    })).valid,
    false,
  );
});
