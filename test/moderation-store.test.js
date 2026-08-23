import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LevelStore } from "../src/level/store.js";

const GUILD_ID = "1540617362477162506";
const USER_ID = "1540628204333703198";
const MODERATOR_ID = "1540628204333703199";
const CHANNEL_ID = "1540628204333703200";
const logger = { info() {}, warn() {}, error() {} };

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), "sofra-moderation-store-"));
  t.after(async () => rm(directory, { recursive: true, force: true }));
  return join(directory, "levels.sqlite");
}

test("warnings persist total offenses while bounding detailed history", async (t) => {
  const filePath = await fixture(t);
  const first = new LevelStore({ filePath, logger });
  await first.init();

  for (let index = 1; index <= 30; index += 1) {
    const result = first.addWarning({
      guildId: GUILD_ID,
      userId: USER_ID,
      moderatorId: MODERATOR_ID,
      reason: `Warning ${index}`,
      createdAt: index * 1_000,
    });
    assert.equal(result.total, index);
  }
  assert.equal(first.getWarnings(GUILD_ID, USER_ID, 25).history.length, 25);
  first.close();

  const second = new LevelStore({ filePath, logger });
  await second.init();
  const warnings = second.getWarnings(GUILD_ID, USER_ID, 10);
  assert.equal(warnings.total, 30);
  assert.equal(warnings.history.length, 10);
  assert.equal(warnings.history[0].reason, "Warning 30");
  second.close();
});

test("lockdowns preserve and restore a channel's previous permission state", async (t) => {
  const filePath = await fixture(t);
  const store = new LevelStore({ filePath, logger });
  await store.init();

  assert.equal(
    store.saveLockdown({
      guildId: GUILD_ID,
      channelId: CHANNEL_ID,
      previousSendMessages: null,
      previousSendMessagesInThreads: false,
      lockedBy: MODERATOR_ID,
      lockedAt: 5_000,
    }),
    true,
  );
  assert.equal(
    store.saveLockdown({
      guildId: GUILD_ID,
      channelId: CHANNEL_ID,
      previousSendMessages: true,
      previousSendMessagesInThreads: true,
      lockedBy: MODERATOR_ID,
    }),
    false,
  );
  assert.deepEqual(store.getLockdown(GUILD_ID, CHANNEL_ID), {
    previousSendMessages: null,
    previousSendMessagesInThreads: false,
    lockedBy: MODERATOR_ID,
    lockedAt: 5_000,
  });
  assert.equal(store.removeLockdown(GUILD_ID, CHANNEL_ID), true);
  assert.equal(store.getLockdown(GUILD_ID, CHANNEL_ID), null);
  store.close();
});

test("schema version 2 upgrades without losing level or auto-role settings", async (t) => {
  const filePath = await fixture(t);
  const original = new LevelStore({ filePath, logger });
  await original.init();
  original.setEnabled(GUILD_ID, true);
  original.setAutoRole(GUILD_ID, "1540628204333703201");
  original.setAutoRoleEnabled(GUILD_ID, true);
  original.close();

  const { DatabaseSync } = await import("node:sqlite");
  const old = new DatabaseSync(filePath);
  old.exec(`
    DROP TABLE moderation_warnings;
    DROP TABLE moderation_warning_totals;
    DROP TABLE channel_lockdowns;
    PRAGMA user_version = 2;
  `);
  old.close();

  const upgraded = new LevelStore({ filePath, logger });
  await upgraded.init();
  assert.equal(upgraded.getConfig(GUILD_ID).enabled, true);
  assert.equal(upgraded.getAutoRoleConfig(GUILD_ID).enabled, true);
  assert.equal(upgraded.getWarnings(GUILD_ID, USER_ID).total, 0);
  upgraded.close();
});
