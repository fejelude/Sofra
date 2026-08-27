import test from "node:test";
import assert from "node:assert/strict";
import {
  chooseSofhiaResponse,
  SOFHIA_EASTER_EGG_RESPONSES,
} from "../src/sofhia/messages.js";

test("the Sofhia easter egg provides exactly 300 unique responses", () => {
  assert.equal(SOFHIA_EASTER_EGG_RESPONSES.length, 300);
  assert.equal(new Set(SOFHIA_EASTER_EGG_RESPONSES).size, 300);
  assert.ok(SOFHIA_EASTER_EGG_RESPONSES.every((response) => response.length <= 250));
});

test("response selection safely reaches the first and last entries", () => {
  assert.equal(chooseSofhiaResponse(() => 0), SOFHIA_EASTER_EGG_RESPONSES[0]);
  assert.equal(chooseSofhiaResponse(() => 0.999999), SOFHIA_EASTER_EGG_RESPONSES[299]);
  assert.equal(chooseSofhiaResponse(() => 1), SOFHIA_EASTER_EGG_RESPONSES[299]);
});
