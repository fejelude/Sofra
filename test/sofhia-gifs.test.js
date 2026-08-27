import test from "node:test";
import assert from "node:assert/strict";
import {
  chooseSofhiaReactionGif,
  SOFHIA_REACTION_GIF_CHANCE,
  SOFHIA_REACTION_GIFS,
} from "../src/sofhia/gifs.js";

function randomSequence(...values) {
  return () => values.shift() ?? 0;
}

test("the reaction GIF pool is curated, unique, and HTTPS-only", () => {
  assert.ok(SOFHIA_REACTION_GIFS.length >= 8);
  assert.equal(
    new Set(SOFHIA_REACTION_GIFS.map(({ url }) => url)).size,
    SOFHIA_REACTION_GIFS.length,
  );
  assert.ok(
    SOFHIA_REACTION_GIFS.every(
      ({ mood, responseMoods, url }) =>
        mood && responseMoods.length > 0 && url.startsWith("https://"),
    ),
  );
});

test("GIF selection stays within the response's mood", () => {
  const gif = chooseSofhiaReactionGif(randomSequence(0, 0), "awkward");
  assert.ok(gif.responseMoods.includes("awkward"));
});

test("reaction GIFs appear on one quarter of selections", () => {
  assert.equal(SOFHIA_REACTION_GIF_CHANCE, 0.25);
  assert.equal(chooseSofhiaReactionGif(() => SOFHIA_REACTION_GIF_CHANCE), null);
  assert.equal(
    chooseSofhiaReactionGif(randomSequence(0, 0)),
    SOFHIA_REACTION_GIFS[0],
  );
  assert.equal(
    chooseSofhiaReactionGif(randomSequence(0, 0.999999)),
    SOFHIA_REACTION_GIFS.at(-1),
  );
});
