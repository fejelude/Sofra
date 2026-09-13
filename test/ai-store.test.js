import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LevelStore } from "../src/level/store.js";

const GUILD_ID = "1540617362477162506";
const CHANNEL_ID = "1540628204333703201";
const logger = { info() {}, warn() {}, error() {} };

test("AI channel configuration persists across database restarts", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "sofra-ai-store-test-"));
  t.after(async () => rm(directory, { recursive: true, force: true }));
  const filePath = join(directory, "levels.sqlite");
  const first = new LevelStore({ filePath, logger });
  await first.init();
  assert.deepEqual(first.getAiConfig(GUILD_ID), { guildId: GUILD_ID, channelId: null });
  first.setAiChannel(GUILD_ID, CHANNEL_ID);
  first.close();

  const second = new LevelStore({ filePath, logger });
  await second.init();
  assert.deepEqual(second.getAiConfig(GUILD_ID), { guildId: GUILD_ID, channelId: CHANNEL_ID });
  assert.deepEqual(second.clearAiChannel(GUILD_ID), { guildId: GUILD_ID, channelId: null });
  second.close();
});
