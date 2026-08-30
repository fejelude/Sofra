import assert from "node:assert/strict";
import test from "node:test";
import { detectContent, detectLinks } from "../src/automod/detector.js";
import { normalizeText } from "../src/automod/normalize.js";

test("normalization removes invisible characters and handles common bypasses", () => {
  assert.equal(detectContent("F\u200b*U C K").tier, 2);
  assert.equal(detectContent("fuuuuuck").tier, 2);
  assert.equal(detectContent("@ss").tier, 3);
  assert.equal(normalizeText("HÉLLO").spaced, "hello");
});

test("high confidence boundaries avoid ordinary substring false positives", () => {
  assert.equal(detectContent("We discussed an assignment in class.").matched, false);
  assert.equal(detectContent("The Scunthorpe meeting is today.").matched, false);
  assert.equal(detectContent("https://example.com/fuck-is-in-this-path").matched, false);
});

test("custom words and whitelist overrides are applied without changing defaults", () => {
  assert.equal(detectContent("pineapple", [{ word: "pineapple", tier: 1 }]).tier, 1);
  assert.equal(detectContent("fuck", [{ word: "fuck", tier: 0 }]).matched, false);
});

test("Discord invites remain separate from normal links", () => {
  assert.deepEqual(detectLinks("watch https://youtube.com/x"), { invite: false, link: true });
  assert.deepEqual(detectLinks("join discord.gg/example"), { invite: true, link: false });
});
