import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LevelStore } from "../src/level/store.js";

const GUILD_ID = "1540617362477162506";
const USER_ONE = "1540628204333703198";
const USER_TWO = "1540628204333703199";
const USER_THREE = "1540628204333703200";
const ROLE_ID = "1540628204333703201";

function loggerFixture() {
  const entries = [];
  return {
    entries,
    info: (...args) => entries.push(["info", ...args]),
    warn: (...args) => entries.push(["warn", ...args]),
    error: (...args) => entries.push(["error", ...args]),
  };
}

async function storeFixture(t) {
  const directory = await mkdtemp(join(tmpdir(), "sofra-level-test-"));
  t.after(async () => rm(directory, { recursive: true, force: true }));
  return {
    directory,
    filePath: join(directory, "levels.sqlite"),
    logger: loggerFixture(),
  };
}

test("SQLite persists settings, XP, and role rewards across restarts", async (t) => {
  const fixture = await storeFixture(t);
  const first = new LevelStore(fixture);
  await first.init();
  first.setEnabled(GUILD_ID, true);
  first.setNotificationChannel(GUILD_ID, "1540628204333703202");
  first.setSettings(GUILD_ID, { xpMin: 20, xpMax: 30, cooldownSeconds: 45 });
  first.setRoleReward(GUILD_ID, ROLE_ID, 5);
  first.awardMessageXp({
    guildId: GUILD_ID,
    userId: USER_ONE,
    messageId: "1540628204333703203",
    now: 10_000,
    xp: 25,
  });
  first.close();

  const second = new LevelStore(fixture);
  await second.init();

  assert.deepEqual(second.getConfig(GUILD_ID), {
    guildId: GUILD_ID,
    enabled: true,
    notificationChannelId: "1540628204333703202",
    xpMin: 20,
    xpMax: 30,
    cooldownSeconds: 45,
  });
  assert.deepEqual(second.getMemberStats(GUILD_ID, USER_ONE), {
    userId: USER_ONE,
    xp: 25,
    awardedMessages: 1,
    rank: 1,
  });
  assert.deepEqual(second.listRoleRewards(GUILD_ID), [
    { roleId: ROLE_ID, requiredLevel: 5 },
  ]);
  second.close();
});

test("awards are idempotent and enforce the persistent cooldown", async (t) => {
  const fixture = await storeFixture(t);
  const store = new LevelStore(fixture);
  await store.init();
  store.setEnabled(GUILD_ID, true);
  store.setSettings(GUILD_ID, { xpMin: 15, xpMax: 25, cooldownSeconds: 60 });

  const first = store.awardMessageXp({
    guildId: GUILD_ID,
    userId: USER_ONE,
    messageId: "1540628204333703210",
    now: 1_000,
    xp: 20,
  });
  const duplicate = store.awardMessageXp({
    guildId: GUILD_ID,
    userId: USER_ONE,
    messageId: "1540628204333703210",
    now: 70_000,
    xp: 20,
  });
  const cooldown = store.awardMessageXp({
    guildId: GUILD_ID,
    userId: USER_ONE,
    messageId: "1540628204333703211",
    now: 30_000,
    xp: 20,
  });
  const eligible = store.awardMessageXp({
    guildId: GUILD_ID,
    userId: USER_ONE,
    messageId: "1540628204333703212",
    now: 61_000,
    xp: 20,
  });

  assert.equal(first.awarded, true);
  assert.equal(duplicate.reason, "duplicate");
  assert.equal(cooldown.reason, "cooldown");
  assert.equal(eligible.awarded, true);
  assert.equal(store.getMemberStats(GUILD_ID, USER_ONE).xp, 40);
  store.close();
});

test("leaderboard ranking is deterministic for XP ties", async (t) => {
  const fixture = await storeFixture(t);
  const store = new LevelStore(fixture);
  await store.init();
  store.setEnabled(GUILD_ID, true);

  for (const [index, userId, xp] of [
    [0, USER_ONE, 20],
    [1, USER_TWO, 50],
    [2, USER_THREE, 50],
  ]) {
    store.awardMessageXp({
      guildId: GUILD_ID,
      userId,
      messageId: `15406282043337032${20 + index}`,
      now: 100_000,
      xp,
    });
  }

  const leaderboard = store.getLeaderboard(GUILD_ID);
  assert.deepEqual(
    leaderboard.rows.map(({ rank, userId, xp }) => ({ rank, userId, xp })),
    [
      { rank: 1, userId: USER_TWO, xp: 50 },
      { rank: 2, userId: USER_THREE, xp: 50 },
      { rank: 3, userId: USER_ONE, xp: 20 },
    ],
  );
  assert.equal(store.getMemberStats(GUILD_ID, USER_THREE).rank, 2);
  store.close();
});

test("a malformed database pauses levels without throwing from init", async (t) => {
  const fixture = await storeFixture(t);
  await writeFile(fixture.filePath, "not a sqlite database", "utf8");
  const store = new LevelStore(fixture);

  await store.init();

  assert.equal(store.getHealth().ok, false);
  assert.throws(() => store.getConfig(GUILD_ID), /unavailable/i);
  assert.ok(fixture.logger.entries.some(([level]) => level === "error"));
});
