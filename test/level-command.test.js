import test from "node:test";
import assert from "node:assert/strict";
import {
  levelCommand,
  PUBLIC_LEVEL_SUBCOMMANDS,
} from "../src/level/command.js";

test("/level exposes public and administrative subcommands", () => {
  const command = levelCommand.toJSON();
  assert.equal(command.name, "level");
  assert.equal(command.dm_permission, false);
  assert.equal(command.default_member_permissions, undefined);
  assert.deepEqual(
    command.options.map((option) => option.name),
    [
      "rank",
      "leaderboard",
      "rewards",
      "enable",
      "disable",
      "channel",
      "channel-reset",
      "settings",
      "role-add",
      "role-remove",
      "test",
      "status",
    ],
  );
  assert.deepEqual([...PUBLIC_LEVEL_SUBCOMMANDS], ["rank", "leaderboard", "rewards"]);
});

test("XP settings and role levels have safe Discord-side limits", () => {
  const command = levelCommand.toJSON();
  const settings = command.options.find((option) => option.name === "settings");
  const roleAdd = command.options.find((option) => option.name === "role-add");
  const cooldown = settings.options.find((option) => option.name === "cooldown-seconds");
  const minimumXp = settings.options.find((option) => option.name === "minimum-xp");
  const roleLevel = roleAdd.options.find((option) => option.name === "level");

  assert.equal(cooldown.min_value, 15);
  assert.equal(cooldown.max_value, 3_600);
  assert.equal(minimumXp.min_value, 1);
  assert.equal(minimumXp.max_value, 100);
  assert.equal(roleLevel.min_value, 1);
  assert.equal(roleLevel.max_value, 1_000);
});
