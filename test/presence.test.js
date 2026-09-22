import test from "node:test";
import assert from "node:assert/strict";
import { guildCount, PresenceService } from "../src/presence.js";

test("presence counts one process and aggregates all shards", async () => {
  assert.equal(await guildCount({ guilds: { cache: { size: 3 } } }), 3);
  assert.equal(await guildCount({ shard: { fetchClientValues: async () => [2, 3, 7] } }), 12);
  await assert.rejects(guildCount({ shard: { fetchClientValues: async () => [2, undefined] } }));
});

test("presence uses Watching and preserves last count on shard failure", async () => {
  const values = [];
  const client = { isReady: () => true, guilds: { cache: { size: 1 } }, user: { setPresence: (value) => values.push(value) } };
  const service = new PresenceService({ client, logger: { warn() {} } });
  await service.refresh();
  assert.deepEqual(values[0].activities, [{ name: "1 server", type: 3 }]);
  client.shard = { fetchClientValues: async () => { throw new Error("offline"); } };
  await service.refresh();
  assert.equal(values.length, 1);
});
