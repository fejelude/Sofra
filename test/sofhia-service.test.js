import test from "node:test";
import assert from "node:assert/strict";
import {
  containsSofhiaTrigger,
  chooseSofhiaCooldownMs,
  SOFHIA_EASTER_EGG_DELETE_AFTER_MS,
  SOFHIA_EASTER_EGG_MAX_COOLDOWN_SECONDS,
  SOFHIA_EASTER_EGG_MIN_COOLDOWN_SECONDS,
  SofhiaEasterEggService,
} from "../src/sofhia/service.js";

const GUILD_ID = "1540617362477162506";
const MEMBER_ID = "1540628204333703198";

function fixture({ random = () => 0 } = {}) {
  const logs = [];
  const logger = {
    info: (...args) => logs.push(["info", ...args]),
    warn: (...args) => logs.push(["warn", ...args]),
    error: (...args) => logs.push(["error", ...args]),
  };
  let now = 100_000;
  let replyCount = 0;
  let deleteCount = 0;
  let lastPayload = null;
  const scheduled = [];
  const reply = {
    id: "1540628204333703200",
    delete: async () => {
      deleteCount += 1;
    },
  };
  const message = {
    id: "1540628204333703199",
    guildId: GUILD_ID,
    channelId: "1540628204333703201",
    author: { id: MEMBER_ID, bot: false },
    webhookId: null,
    system: false,
    content: "Wait, did someone say Sofhia?",
    inGuild: () => true,
    reply: async (payload) => {
      replyCount += 1;
      lastPayload = payload;
      assert.equal(payload.allowedMentions.repliedUser, false);
      return reply;
    },
  };
  const service = new SofhiaEasterEggService({
    logger,
    random,
    now: () => now,
    schedule: (callback, delay) => {
      scheduled.push({ callback, delay });
      return { unref() {} };
    },
  });
  return {
    service,
    message,
    reply,
    logs,
    scheduled,
    setNow: (value) => {
      now = value;
    },
    getReplyCount: () => replyCount,
    getDeleteCount: () => deleteCount,
    getLastPayload: () => lastPayload,
  };
}

test("trigger matching is case-insensitive and respects word boundaries", () => {
  for (const content of [
    "sofi",
    "SOFIE!",
    "SOFHIA!",
    "hello Fia",
    "hello Fhia",
    "Pia?",
    "(SoFi)",
  ]) {
    assert.equal(containsSofhiaTrigger(content), true, content);
  }
  for (const content of [
    "piano",
    "utopia",
    "fiat",
    "sophisticated",
    "sofield",
    "sofiever",
    "fhialike",
  ]) {
    assert.equal(containsSofhiaTrigger(content), false, content);
  }
});

test("reaction GIFs are occasional and text-only replies stay possible", async () => {
  const noGif = fixture({ random: () => 0.5 });
  await noGif.service.handleMessage(noGif.message);
  assert.equal(noGif.getLastPayload().embeds, undefined);

  const randomValues = [0, 0, 0];
  const withGif = fixture({ random: () => randomValues.shift() ?? 0 });
  await withGif.service.handleMessage(withGif.message);
  assert.match(withGif.getLastPayload().embeds[0].image.url, /^https:\/\//);
});

test("one matching message creates one temporary direct reply", async () => {
  const { service, message, scheduled, getReplyCount, getDeleteCount } = fixture();
  message.content = "sofi sofi SOFHIA fhia pia";

  assert.equal(await service.handleMessage(message), true);
  assert.equal(getReplyCount(), 1);
  assert.equal(scheduled.length, 1);
  assert.equal(scheduled[0].delay, SOFHIA_EASTER_EGG_DELETE_AFTER_MS);
  await scheduled[0].callback();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(getDeleteCount(), 1);
});

test("the cooldown is per user and server", async () => {
  const { service, message, setNow, getReplyCount } = fixture();
  await service.handleMessage(message);
  setNow(100_000 + SOFHIA_EASTER_EGG_MIN_COOLDOWN_SECONDS * 1_000 - 1);
  await service.handleMessage({ ...message, id: "1540628204333703202" });
  assert.equal(getReplyCount(), 1);

  setNow(100_000 + SOFHIA_EASTER_EGG_MIN_COOLDOWN_SECONDS * 1_000);
  await service.handleMessage({ ...message, id: "1540628204333703203" });
  assert.equal(getReplyCount(), 2);
});

test("cooldowns are randomized from 4 through 15 seconds", () => {
  assert.equal(
    chooseSofhiaCooldownMs(() => 0),
    SOFHIA_EASTER_EGG_MIN_COOLDOWN_SECONDS * 1_000,
  );
  assert.equal(chooseSofhiaCooldownMs(() => 0.5), 10_000);
  assert.equal(
    chooseSofhiaCooldownMs(() => 0.999999),
    SOFHIA_EASTER_EGG_MAX_COOLDOWN_SECONDS * 1_000,
  );
  assert.equal(
    chooseSofhiaCooldownMs(() => 1),
    SOFHIA_EASTER_EGG_MAX_COOLDOWN_SECONDS * 1_000,
  );
});

test("bots, webhooks, system messages, and non-matches are ignored", async () => {
  const { service, message, getReplyCount } = fixture();
  await service.handleMessage({ ...message, author: { id: MEMBER_ID, bot: true } });
  await service.handleMessage({ ...message, webhookId: "1540628204333703204" });
  await service.handleMessage({ ...message, system: true });
  await service.handleMessage({ ...message, content: "ordinary conversation" });
  assert.equal(getReplyCount(), 0);
});

test("already-deleted temporary replies fail silently", async () => {
  const { service, message, reply, logs } = fixture();
  reply.delete = async () => {
    const error = new Error("Unknown Message");
    error.code = 10_008;
    throw error;
  };
  await assert.doesNotReject(service.deleteTemporaryReply(reply, message));
  assert.equal(logs.length, 0);
});
