import test from "node:test";
import assert from "node:assert/strict";
import { TrafficGuard } from "../src/automod/traffic.js";
const make = (id, content = id, guild = "a") => ({ id, content, guild: { id: guild }, author: { id: "member" }, mentions: { users: new Map(), roles: new Map() } });
const config = { spamEnabled: true, messageLimit: 7, mentionLimit: 6 };
test("flood detection isolates servers and expires its window", () => {
  let now = 100;
  const guard = new TrafficGuard({ now: () => now });
  for (let n = 0; n < 6; n++) assert.equal(guard.inspect(make(String(n)), config), null);
  assert.equal(guard.inspect(make("six", "six", "b"), config), null);
  assert.equal(guard.inspect(make("six"), config), "message-flood");
  now += 10001;
  assert.equal(guard.inspect(make("seven"), config), null);
});
test("duplicate spam, repeated events, mentions, and disabled mode", () => {
  const guard = new TrafficGuard();
  for (let n = 0; n < 3; n++) assert.equal(guard.inspect(make(String(n), "hello"), config), null);
  assert.equal(guard.inspect(make("2", "hello"), config), null);
  assert.equal(guard.inspect(make("3", "hello"), config), "duplicate-spam");
  const message = make("4"); message.mentions.everyone = true;
  assert.equal(guard.inspect(message, config), "mention-spam");
  assert.equal(guard.inspect(message, { spamEnabled: false }), null);
});
