import assert from "node:assert/strict";
import test from "node:test";
import { LevelStore } from "../src/level/store.js";

const GUILD = "12345678901234567", ROLE = "22345678901234567", CHANNEL = "32345678901234567";
const logger = { error() {}, warn() {}, info() {} };

test("automod configuration, roles, channels, and words persist in shared storage", async () => {
  const store = new LevelStore({ filePath: ":memory:", logger }); await store.init();
  store.setAutomodConfig(GUILD, { enabled: true, mildAction: "warn", linksEnabled: true, warningCooldownSeconds: 45 });
  store.setAutomodRole(GUILD, ROLE, "manager"); store.setAutomodChannel(GUILD, CHANNEL, "relaxed"); store.setAutomodWord(GUILD, "pineapple", 2);
  store.setAutomodCategory(GUILD, "sexual", { enabled: true, action: "delete_warn" });
  store.setAutomodRule(GUILD, "custom phrase", { category: "custom", severity: 3, actionOverride: "delete_timeout" });
  const config = store.getAutomodConfig(GUILD);
  assert.equal(config.enabled, true); assert.equal(config.mildAction, "warn"); assert.equal(config.linksEnabled, true); assert.equal(config.warningCooldownSeconds, 45);
  assert.deepEqual(config.roles, [{ roleId: ROLE, kind: "manager" }]); assert.deepEqual(config.channels, [{ channelId: CHANNEL, mode: "relaxed" }]); assert.equal(config.words.some((rule) => rule.word === "pineapple" && rule.tier === 2), true);
  assert.equal(config.words.some((rule) => rule.term === "custom phrase" && rule.severity === 3), true);
  assert.deepEqual(config.categories.sexual, { enabled: true, action: "delete_warn" });
  store.close();
});
