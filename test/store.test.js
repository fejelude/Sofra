import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonWelcomeConfigStore } from "../src/welcome/store.js";

const GUILD_ID = "123456789012345678";
const CHANNEL_ID = "223456789012345678";
const OTHER_CHANNEL_ID = "323456789012345678";

function loggerFixture() {
  const entries = [];
  return {
    entries,
    info: (...args) => entries.push(["info", ...args]),
    warn: (...args) => entries.push(["warn", ...args]),
    error: (...args) => entries.push(["error", ...args]),
  };
}

async function temporaryStore(t) {
  const directory = await mkdtemp(join(tmpdir(), "sofra-welcome-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return {
    directory,
    filePath: join(directory, "welcome-config.json"),
    logger: loggerFixture(),
  };
}

test("configuration survives a store restart", async (t) => {
  const fixture = await temporaryStore(t);
  const first = new JsonWelcomeConfigStore(fixture);
  await first.init();
  await first.setChannel(GUILD_ID, CHANNEL_ID);
  await first.setEnabled(GUILD_ID, true);

  const second = new JsonWelcomeConfigStore(fixture);
  await second.init();

  assert.deepEqual(second.getGuildConfig(GUILD_ID), {
    enabled: true,
    channelId: CHANNEL_ID,
  });
  assert.equal(second.getHealth().ok, true);

  const document = JSON.parse(await readFile(fixture.filePath, "utf8"));
  assert.deepEqual(document, {
    version: 1,
    guilds: {
      [GUILD_ID]: { enabled: true, channelId: CHANNEL_ID },
    },
  });
});

test("concurrent changes are serialized without losing fields", async (t) => {
  const fixture = await temporaryStore(t);
  const store = new JsonWelcomeConfigStore(fixture);
  await store.init();

  await Promise.all([
    store.setChannel(GUILD_ID, OTHER_CHANNEL_ID),
    store.setEnabled(GUILD_ID, true),
  ]);

  assert.deepEqual(store.getGuildConfig(GUILD_ID), {
    enabled: true,
    channelId: OTHER_CHANNEL_ID,
  });
});

test("malformed storage does not crash and a valid command repairs it", async (t) => {
  const fixture = await temporaryStore(t);
  await writeFile(fixture.filePath, "this is not json", "utf8");

  const store = new JsonWelcomeConfigStore(fixture);
  await store.init();

  assert.equal(store.getHealth().ok, false);
  assert.deepEqual(store.getGuildConfig(GUILD_ID), {
    enabled: false,
    channelId: null,
  });

  await store.setChannel(GUILD_ID, CHANNEL_ID);
  assert.equal(store.getHealth().ok, true);

  const repaired = JSON.parse(await readFile(fixture.filePath, "utf8"));
  assert.equal(repaired.guilds[GUILD_ID].channelId, CHANNEL_ID);
});

test("failed writes leave the last known configuration unchanged", async (t) => {
  const fixture = await temporaryStore(t);
  await mkdir(fixture.filePath);

  const store = new JsonWelcomeConfigStore(fixture);
  await store.init();

  await assert.rejects(store.setChannel(GUILD_ID, CHANNEL_ID));
  assert.deepEqual(store.getGuildConfig(GUILD_ID), {
    enabled: false,
    channelId: null,
  });
  assert.equal(store.getHealth().ok, false);
  assert.ok(fixture.logger.entries.some(([level]) => level === "error"));
});
