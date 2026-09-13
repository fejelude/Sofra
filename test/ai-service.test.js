import test from "node:test";
import assert from "node:assert/strict";
import {
  buildGeminiGenerateContentUrl,
  extractGeminiResponse,
  GEMINI_API_BASE_URL,
  SofraAiService,
  SOFRA_SYSTEM_PROMPT,
  splitDiscordMessage,
} from "../src/ai/service.js";

const GUILD_ID = "1540617362477162506";
const CHANNEL_ID = "1540628204333703201";
const MEMBER_ID = "1540628204333703198";

function fixture({ response = "hey girl 😭", fetchImpl } = {}) {
  const logs = [];
  const replies = [];
  const requests = [];
  const service = new SofraAiService({
    geminiApiKey: "gemini-secret-key",
    store: { getAiConfig: () => ({ channelId: CHANNEL_ID }) },
    logger: {
      error: (...args) => logs.push(["error", ...args]),
      warn: (...args) => logs.push(["warn", ...args]),
    },
    fetchImpl: fetchImpl ?? (async (_url, options) => {
      requests.push(options);
      return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: response }] } }] }) };
    }),
  });
  const message = {
    id: "1540628204333703199",
    guildId: GUILD_ID,
    channelId: CHANNEL_ID,
    author: { id: MEMBER_ID, bot: false },
    webhookId: null,
    system: false,
    content: "what do you think?",
    inGuild: () => true,
    channel: { sendTyping: async () => undefined },
    reply: async (payload) => replies.push(payload),
  };
  return { service, message, logs, replies, requests };
}

test("AI chat only handles human messages in its configured channel", async () => {
  const { service, message, replies, requests } = fixture();
  assert.equal(await service.handleMessage({ ...message, channelId: "1540628204333703202" }), false);
  assert.equal(await service.handleMessage({ ...message, author: { id: MEMBER_ID, bot: true } }), false);
  assert.equal(await service.handleMessage({ ...message, webhookId: "hook" }), false);
  assert.equal(replies.length, 0);
  assert.equal(requests.length, 0);
});

test("/ai channel saves the selected channel without requiring a manually copied ID", async () => {
  let savedChannelId = null;
  let reply = null;
  const { service } = fixture();
  service.store = {
    setAiChannel: (_guildId, channelId) => {
      savedChannelId = channelId;
    },
    getAiConfig: () => ({ channelId: savedChannelId }),
    clearAiChannel: () => {
      savedChannelId = null;
    },
  };
  const interaction = {
    commandName: "ai",
    guildId: GUILD_ID,
    guild: { id: GUILD_ID },
    user: { id: MEMBER_ID },
    deferred: false,
    replied: false,
    inGuild: () => true,
    isChatInputCommand: () => true,
    memberPermissions: { has: () => true },
    deferReply: async () => {
      interaction.deferred = true;
    },
    editReply: async (content) => {
      reply = content;
    },
    options: {
      getSubcommand: () => "channel",
      getChannel: () => ({ id: CHANNEL_ID, toString: () => "#ai-chat" }),
    },
  };

  assert.equal(await service.handleInteraction(interaction), true);
  assert.equal(savedChannelId, CHANNEL_ID);
  assert.match(reply, /#ai-chat/);
});

test("AI chat sends Gemini the Sofra personality and isolated recent user history", async () => {
  const { service, message, replies, requests } = fixture({ response: "first answer" });
  await service.handleMessage(message);
  await service.handleMessage({ ...message, id: "1540628204333703203", content: "why?" });

  assert.equal(replies.length, 2);
  assert.equal(GEMINI_API_BASE_URL, "https://generativelanguage.googleapis.com/v1/models");
  assert.deepEqual(replies[0].allowedMentions, { parse: [], repliedUser: false });
  const latest = JSON.parse(requests[1].body);
  assert.equal(requests[1].headers["x-goog-api-key"], "gemini-secret-key");
  assert.equal(latest.systemInstruction.parts[0].text, SOFRA_SYSTEM_PROMPT);
  assert.deepEqual(latest.contents, [
    { role: "user", parts: [{ text: "what do you think?" }] },
    { role: "model", parts: [{ text: "first answer" }] },
    { role: "user", parts: [{ text: "why?" }] },
  ]);

  await service.handleMessage({
    ...message,
    id: "1540628204333703204",
    author: { id: "1540628204333703210", bot: false },
    content: "unrelated",
  });
  const otherUser = JSON.parse(requests[2].body);
  assert.deepEqual(otherUser.contents, [{ role: "user", parts: [{ text: "unrelated" }] }]);
});

test("Gemini requests use the stable v1 generateContent endpoint", async () => {
  assert.equal(
    buildGeminiGenerateContentUrl(GEMINI_API_BASE_URL, "gemini-2.5-flash"),
    "https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent",
  );
  assert.equal(
    buildGeminiGenerateContentUrl(`${GEMINI_API_BASE_URL}/`, "model/name"),
    "https://generativelanguage.googleapis.com/v1/models/model%2Fname:generateContent",
  );
});

test("AI chat prevents duplicate concurrent replies and handles provider failures safely", async () => {
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const { service, message, logs, replies } = fixture({
    fetchImpl: async () => {
      await pending;
      return { ok: false, status: 503, text: async () => '{"error":{"message":"gemini-secret-key unavailable"}}' };
    },
  });
  const first = service.handleMessage(message);
  const duplicate = service.handleMessage(message);
  release();
  assert.equal(await duplicate, true);
  assert.equal(await first, true);
  assert.equal(replies.length, 1);
  assert.match(replies[0].content, /brain just lagged/i);
  assert.equal(logs.filter(([level, event]) => level === "error" && event === "AI_CHAT_FAILED").length, 1);
  const [, , , , context] = logs.find(([level, event]) => level === "error" && event === "AI_CHAT_FAILED");
  assert.equal(context.geminiHttpStatus, 503);
  assert.equal(context.geminiResponseBody, '{"error":{"message":"[REDACTED] unavailable"}}');
});

test("Gemini response extraction and Discord splitting reject malformed output safely", () => {
  assert.equal(extractGeminiResponse({ candidates: [{ content: { parts: [{ text: "  hello  " }] } }] }), "hello");
  assert.equal(extractGeminiResponse({ candidates: [{ content: {} }] }), "");
  const chunks = splitDiscordMessage("a".repeat(4_000));
  assert.equal(chunks.length, 3);
  assert.ok(chunks.every((chunk) => chunk.length <= 1_900));
});
