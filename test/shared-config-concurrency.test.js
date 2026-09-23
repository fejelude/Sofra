import test from "node:test";
import assert from "node:assert/strict";
import { SharedConfigSync } from "../src/shared-config.js";
const create = () => new SharedConfigSync({ url: "https://example.com", token: "test", logger: { warn() {}, info() {} }, welcomeStore: {}, levelStore: {} });
test("tasks serialize within a guild and a failed task cannot poison the queue", async () => {
  const sync = create(); const order = [];
  const first = sync.enqueue("a", async () => { await Promise.resolve(); order.push(1); throw new Error("test"); });
  const second = sync.enqueue("a", async () => order.push(2));
  await assert.rejects(first); await second;
  assert.deepEqual(order, [1, 2]);
});
test("seeding uses HSETNX and does not claim a raced dashboard value was applied", async () => {
  const sync = create(); sync.snapshotSection = () => ({ enabled: false });
  let command; sync.command = async (value) => { command = value; return 0; };
  await sync.seedSection("a", "welcome");
  assert.equal(command[0], "HSETNX");
  assert.equal(sync.remoteCache.size, 0);
});
test("a mutation arriving during a push remains dirty", async () => {
  const sync = create(); sync.snapshotSection = () => ({ enabled: true });
  sync.dirty.add("a:welcome"); sync.versions.set("a:welcome", 1);
  sync.writeRemoteSection = async () => sync.versions.set("a:welcome", 2);
  await sync.pushSection("a", "welcome");
  assert.equal(sync.dirty.has("a:welcome"), true);
});


test("shared config defaults to one global dirty-queue check per minute", () => {
  const sync = create();
  assert.equal(sync.pollMs, 60_000);
});

test("dirty polling refreshes only changed installed guilds and removes completed markers", async () => {
  const sync = create();
  sync.client = {
    guilds: {
      cache: new Map([["a", {}], ["b", {}]]),
    },
  };
  const commands = [];
  const refreshed = [];
  sync.command = async (args) => {
    commands.push(args);
    if (args[0] === "SMEMBERS") return ["a", "missing"];
    return 1;
  };
  sync.syncGuild = async (guildId) => {
    refreshed.push(guildId);
    return true;
  };

  await sync.syncChangedGuilds();

  assert.deepEqual(refreshed, ["a"]);
  assert.ok(commands.some((args) => args[0] === "SET" && args[1] === "sofra:runtime:heartbeat"));
  assert.ok(commands.some((args) => args[0] === "SREM" && args.includes("missing")));
  assert.ok(commands.some((args) => args[0] === "SREM" && args.includes("a")));
  assert.equal(commands.some((args) => args.includes("b")), false);
});

test("failed guild refresh stays dirty for a later retry", async () => {
  const sync = create();
  sync.client = { guilds: { cache: new Map([["a", {}]]) } };
  const commands = [];
  sync.command = async (args) => {
    commands.push(args);
    if (args[0] === "SMEMBERS") return ["a"];
    return 1;
  };
  sync.syncGuild = async () => false;

  await sync.syncChangedGuilds();

  assert.equal(commands.some((args) => args[0] === "SREM" && args.includes("a")), false);
});
