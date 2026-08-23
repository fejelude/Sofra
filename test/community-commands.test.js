import test from "node:test";
import assert from "node:assert/strict";
import { PermissionFlagsBits } from "discord.js";
import { communityCommands } from "../src/community/commands.js";

test("community commands expose info, announcement, poll, and meme tools", () => {
  const commands = communityCommands.map((command) => command.toJSON());
  assert.deepEqual(
    commands.map((command) => command.name),
    ["userinfo", "serverinfo", "embed", "poll", "meme"],
  );
  assert.equal(
    commands.find((command) => command.name === "embed").default_member_permissions,
    String(PermissionFlagsBits.ManageMessages),
  );
  assert.equal(
    commands.find((command) => command.name === "poll").default_member_permissions,
    String(PermissionFlagsBits.ManageMessages),
  );
  assert.equal(
    commands.find((command) => command.name === "meme").default_member_permissions,
    undefined,
  );
});

test("native polls accept two to five choices and bounded durations", () => {
  const poll = communityCommands
    .map((command) => command.toJSON())
    .find((command) => command.name === "poll");
  assert.equal(poll.options.find((option) => option.name === "option-1").required, true);
  assert.equal(poll.options.find((option) => option.name === "option-2").required, true);
  assert.equal(poll.options.find((option) => option.name === "option-5").required, false);
  assert.deepEqual(
    poll.options
      .find((option) => option.name === "duration-hours")
      .choices.map((choice) => choice.value),
    [1, 4, 8, 24, 72, 168],
  );
});
