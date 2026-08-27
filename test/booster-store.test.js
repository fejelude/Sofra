import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LevelStore } from "../src/level/store.js";

const GUILD_ID = "1540617362477162506";
const ROLE_ID = "1540628204333703198";
const CHANNEL_ID = "1540628204333703199";
const logger = { info() {}, warn() {}, error() {} };

test("booster role, channel, and state persist across restarts", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "sofra-booster-test-"));
  t.after(async () => rm(directory, { recursive: true, force: true }));
  const filePath = join(directory, "levels.sqlite");

  const first = new LevelStore({ filePath, logger });
  await first.init();
  assert.deepEqual(first.getBoosterConfig(GUILD_ID), {
    guildId: GUILD_ID,
    enabled: false,
    roleId: null,
    channelId: null,
  });
  first.setBoosterConfig(GUILD_ID, { roleId: ROLE_ID, channelId: CHANNEL_ID });
  first.setBoosterEnabled(GUILD_ID, true);
  first.close();

  const second = new LevelStore({ filePath, logger });
  await second.init();
  assert.deepEqual(second.getBoosterConfig(GUILD_ID), {
    guildId: GUILD_ID,
    enabled: true,
    roleId: ROLE_ID,
    channelId: CHANNEL_ID,
  });
  assert.equal(second.clearBoosterRole(GUILD_ID).enabled, false);
  assert.equal(second.getBoosterConfig(GUILD_ID).roleId, null);
  second.setBoosterConfig(GUILD_ID, { roleId: ROLE_ID, channelId: CHANNEL_ID });
  second.setBoosterEnabled(GUILD_ID, true);
  assert.equal(second.clearBoosterChannel(GUILD_ID).channelId, null);
  assert.equal(second.getBoosterConfig(GUILD_ID).enabled, false);
  second.close();
});

test("schema version 5 upgrades with booster settings without losing tickets", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "sofra-booster-migration-"));
  t.after(async () => rm(directory, { recursive: true, force: true }));
  const filePath = join(directory, "levels.sqlite");

  const initial = new LevelStore({ filePath, logger });
  await initial.init();
  initial.setEnabled(GUILD_ID, true);
  initial.close();

  const { DatabaseSync } = await import("node:sqlite");
  const oldDatabase = new DatabaseSync(filePath);
  oldDatabase.exec("DROP TABLE booster_config; PRAGMA user_version = 5;");
  oldDatabase.close();

  const upgraded = new LevelStore({ filePath, logger });
  await upgraded.init();
  assert.equal(upgraded.getConfig(GUILD_ID).enabled, true);
  assert.deepEqual(upgraded.getBoosterConfig(GUILD_ID), {
    guildId: GUILD_ID,
    enabled: false,
    roleId: null,
    channelId: null,
  });
  upgraded.close();
});
