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
  for (const innocent of ["class", "pass", "grass", "assignment", "Dick Grayson is Robin", "the rooster cock-a-doodle-dooed", "`fuck` in a code example"]) assert.equal(detectContent(innocent).matched, false, innocent);
  assert.equal(detectContent("The Scunthorpe meeting is today.").matched, false);
  assert.equal(detectContent("https://example.com/fuck-is-in-this-path").matched, false);
});

test("categorized phrases, context, severity, and obfuscation work together", () => {
  assert.equal(detectContent("s-h-1-t").category, "profanity");
  assert.equal(detectContent("everyone hates you, leave this server", [], { categories: { toxic: { enabled: true } } }).category, "toxic");
  assert.equal(detectContent("I will kill you", [], { targeted: true }).severity, 4);
  assert.equal(detectContent("send me nudes").category, "sexual");
  assert.equal(detectContent("@member send me nudes", [], { mentionCount: 1 }).category, "sexual_harassment");
  assert.equal(detectContent("what does the word idiot mean?").matched, false);
});

test("category settings and multiple matches select the most severe rule", () => {
  const categories = { profanity: { enabled: false }, hate: { enabled: true } };
  assert.equal(detectContent("shit", [], { categories }).matched, false);
  const result = detectContent("shit nigger", [], { categories });
  assert.equal(result.category, "hate");
  assert.equal(result.severity, 4);
});

test("custom words and whitelist overrides are applied without changing defaults", () => {
  assert.equal(detectContent("pineapple", [{ word: "pineapple", tier: 1 }]).tier, 1);
  assert.equal(detectContent("fuck", [{ word: "fuck", tier: 0 }]).matched, false);
});

test("Discord invites remain separate from normal links", () => {
  assert.deepEqual(detectLinks("watch https://youtube.com/x"), { invite: false, link: true });
  assert.deepEqual(detectLinks("join discord.gg/example"), { invite: true, link: false });
});
