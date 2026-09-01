import test from "node:test";
import assert from "node:assert/strict";
import { SharedConfigSync } from "../src/shared-config.js";

const GUILD_ID = "123456789012345678";

test("shared config applies dashboard randomized welcome mode to the bot store", async () => {
  const calls = [];
  const welcomeStore = {
    setChannel: async (...args) => calls.push(["channel", ...args]),
    setCustomization: async (...args) => calls.push(["customization", ...args]),
    setEnabled: async (...args) => calls.push(["enabled", ...args]),
  };
  const sync = new SharedConfigSync({
    url: "https://example.com",
    token: "test",
    levelStore: {},
    welcomeStore,
    logger: { warn: () => undefined, info: () => undefined },
  });

  await sync.applyWelcome(GUILD_ID, {
    enabled: true,
    channelId: "223456789012345678",
    randomMessages: false,
    messageTemplate: "Hello {user.mention} ♡",
  });

  const customization = calls.find(([kind]) => kind === "customization");
  assert.equal(customization[2].randomMessages, false);
  assert.equal(customization[2].messageTemplate, "Hello {user.mention} ♡");
});
