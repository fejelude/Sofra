import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LevelStore } from "../src/level/store.js";

const GUILD_ID = "1540617362477162506";
const ROLE_ID = "1540628204333703198";
const logger = { info() {}, warn() {}, error() {} };

test("auto-role configuration persists across database restarts", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "sofra-autorole-test-"));
  t.after(async () => rm(directory, { recursive: true, force: true }));
  const filePath = join(directory, "levels.sqlite");

  const first = new LevelStore({ filePath, logger });
  await first.init();
  assert.deepEqual(first.getAutoRoleConfig(GUILD_ID), {
    guildId: GUILD_ID,
    enabled: false,
    roleId: null,
  });
  first.setAutoRole(GUILD_ID, ROLE_ID);
  first.setAutoRoleEnabled(GUILD_ID, true);
  assert.equal(first.setAutoRole(GUILD_ID, ROLE_ID).enabled, false);
  first.setAutoRoleEnabled(GUILD_ID, true);
  first.close();

  const second = new LevelStore({ filePath, logger });
  await second.init();
  assert.deepEqual(second.getAutoRoleConfig(GUILD_ID), {
    guildId: GUILD_ID,
    enabled: true,
    roleId: ROLE_ID,
  });
  assert.deepEqual(second.clearAutoRole(GUILD_ID), {
    guildId: GUILD_ID,
    enabled: false,
    roleId: null,
  });
  second.close();
});

test("existing level schema upgrades to auto-role schema without losing data", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "sofra-autorole-migration-"));
  t.after(async () => rm(directory, { recursive: true, force: true }));
  const filePath = join(directory, "levels.sqlite");

  const original = new LevelStore({ filePath, logger });
  await original.init();
  original.setEnabled(GUILD_ID, true);
  original.close();

  const { DatabaseSync } = await import("node:sqlite");
  const oldDatabase = new DatabaseSync(filePath);
  oldDatabase.exec("DROP TABLE auto_role_config; PRAGMA user_version = 1;");
  oldDatabase.close();

  const upgraded = new LevelStore({ filePath, logger });
  await upgraded.init();
  assert.equal(upgraded.getConfig(GUILD_ID).enabled, true);
  assert.deepEqual(upgraded.getAutoRoleConfig(GUILD_ID), {
    guildId: GUILD_ID,
    enabled: false,
    roleId: null,
  });
  upgraded.close();
});
