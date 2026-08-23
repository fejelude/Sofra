import test from "node:test";
import assert from "node:assert/strict";
import {
  levelFromXp,
  levelProgress,
  progressBar,
  totalXpForLevel,
  xpNeededForNextLevel,
} from "../src/level/math.js";

test("level curve uses predictable increasing thresholds", () => {
  assert.equal(xpNeededForNextLevel(0), 100);
  assert.equal(xpNeededForNextLevel(1), 155);
  assert.equal(xpNeededForNextLevel(2), 220);
  assert.equal(totalXpForLevel(0), 0);
  assert.equal(totalXpForLevel(1), 100);
  assert.equal(totalXpForLevel(2), 255);
  assert.equal(totalXpForLevel(3), 475);
});

test("total XP maps to the correct level boundaries", () => {
  assert.equal(levelFromXp(0), 0);
  assert.equal(levelFromXp(99), 0);
  assert.equal(levelFromXp(100), 1);
  assert.equal(levelFromXp(254), 1);
  assert.equal(levelFromXp(255), 2);
  assert.equal(levelFromXp(475), 3);
});

test("progress reports current, remaining, and visual completion", () => {
  const progress = levelProgress(150);
  assert.equal(progress.level, 1);
  assert.equal(progress.current, 50);
  assert.equal(progress.needed, 155);
  assert.equal(progress.remaining, 105);
  assert.equal(progress.percentage, 32);
  assert.equal(progressBar(0.5), "▰▰▰▰▰▱▱▱▱▱");
});
