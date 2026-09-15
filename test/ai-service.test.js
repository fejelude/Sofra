import test from "node:test";
import assert from "node:assert/strict";
import {
  LLAMA_API_BASE_URL,
  LLAMA_MODEL,
  SofraAiService,
  SOFRA_SYSTEM_PROMPT,
  splitDiscordMessage,
} from "../src/ai/service.js";

const GUILD_ID = "1540617362477162506";
const CHANNEL_ID = "1540628204333703201";
const MEMBER_ID = "1540628204333703198";

function fixture({ response = "hey girl 😭", create } = {}) {
  const logs = [];
  const replies = [];
  const requests = [];
  const openaiClient = {
    chat: {
      completions: {
        create: create ?? (async (request) => {
          requests.push(request);
          return { choices: [{ message: { content: response } }] };
        }),
      },
    },
  };
  const service = new SofraAiService({
    openaiClient,
    store: { getAiConfig: () => ({ channelId: CHANNEL_ID }) },
    logger: {
      error: (...args) => logs.push(["error", ...args]),
      warn: (...args) => logs.push(["warn", ...args]),
    },
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
    setAiChannel: (_guildId, channelId) => { savedChannelId = channelId; },
    getAiConfig: () => ({ channelId: savedChannelId }),
    clearAiChannel: () => { savedChannelId = null; },
  };
  const interaction = {
    commandName: "ai", guildId: GUILD_ID, guild: { id: GUILD_ID }, user: { id: MEMBER_ID }, deferred: false, replied: false,
    inGuild: () => true, isChatInputCommand: () => true, memberPermissions: { has: () => true },
    deferReply: async () => { interaction.deferred = true; }, editReply: async (content) => { reply = content; },
    options: { getSubcommand: () => "channel", getChannel: () => ({ id: CHANNEL_ID, toString: () => "#ai-chat" }) },
  };
  assert.equal(await service.handleInteraction(interaction), true);
  assert.equal(savedChannelId, CHANNEL_ID);
  assert.match(reply, /#ai-chat/);
});

test("AI chat sends the intact Sofra personality and isolated history through OpenAI chat completions", async () => {
  const { service, message, replies, requests } = fixture({ response: "first answer" });
  await service.handleMessage(message);
  await service.handleMessage({ ...message, id: "1540628204333703203", content: "why?" });
  assert.equal(replies.length, 2);
  assert.equal(LLAMA_API_BASE_URL, "https://cambridge-employees-attach-camping.trycloudflare.com/v1");
  assert.equal(LLAMA_MODEL, "llama-3.1-8b");
  assert.deepEqual(replies[0].allowedMentions, { parse: [], repliedUser: false });
  assert.deepEqual(requests[1], {
    model: "llama-3.1-8b", temperature: 0.7,
    messages: [
      { role: "system", content: SOFRA_SYSTEM_PROMPT },
      { role: "user", content: "what do you think?" },
      { role: "assistant", content: "first answer" },
      { role: "user", content: "why?" },
    ],
  });
});

test("AI chat sends Discord's typing indicator before local inference and handles failures safely", async () => {
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const { service, message, logs, replies } = fixture({
    create: async () => { await pending; const error = new Error("unavailable"); error.status = 503; throw error; },
  });
  let typingSent = false;
  message.channel.sendTyping = async () => { typingSent = true; };
  const first = service.handleMessage(message);
  const duplicate = service.handleMessage(message);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(typingSent, true);
  release();
  assert.equal(await duplicate, true);
  assert.equal(await first, true);
  assert.equal(replies.length, 1);
  const [, , , , context] = logs.find(([level, event]) => level === "error" && event === "AI_CHAT_FAILED");
  assert.equal(context.openAiStatus, 503);
});

test("Discord splitting rejects empty output safely", () => {
  const chunks = splitDiscordMessage("a".repeat(4_000));
  assert.equal(chunks.length, 3);
  assert.ok(chunks.every((chunk) => chunk.length <= 1_900));
});
