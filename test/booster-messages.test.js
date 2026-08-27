import test from "node:test";
import assert from "node:assert/strict";
import {
  BOOSTER_THANK_YOU_MESSAGES,
  chooseBoosterThankYou,
} from "../src/booster/messages.js";

test("booster celebrations provide exactly 67 unique messages", () => {
  assert.equal(BOOSTER_THANK_YOU_MESSAGES.length, 67);
  assert.equal(new Set(BOOSTER_THANK_YOU_MESSAGES).size, 67);
  assert.ok(BOOSTER_THANK_YOU_MESSAGES.every((message) => message.length <= 300));
});

test("message selection covers the first and last templates safely", () => {
  assert.equal(chooseBoosterThankYou(() => 0), BOOSTER_THANK_YOU_MESSAGES[0]);
  assert.equal(chooseBoosterThankYou(() => 0.999999), BOOSTER_THANK_YOU_MESSAGES[66]);
  assert.equal(chooseBoosterThankYou(() => 1), BOOSTER_THANK_YOU_MESSAGES[66]);
});
