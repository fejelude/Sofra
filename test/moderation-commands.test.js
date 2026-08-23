import test from "node:test";
import assert from "node:assert/strict";
import { PermissionFlagsBits } from "discord.js";
import { moderationCommands } from "../src/moderation/commands.js";

test("the final moderation suite exposes every requested command", () => {
  const commands = moderationCommands.map((command) => command.toJSON());
  assert.deepEqual(
    commands.map((command) => command.name),
    [
      "purge",
      "ban",
      "kick",
      "mute",
      "warn",
      "warnings",
      "unban",
      "unmute",
      "lockdown",
      "unlock",
      "slowmode",
    ],
  );
  assert.ok(commands.every((command) => command.dm_permission === false));
  assert.equal(
    commands.find((command) => command.name === "purge").default_member_permissions,
    String(PermissionFlagsBits.ManageMessages),
  );
  assert.equal(
    commands.find((command) => command.name === "ban").default_member_permissions,
    String(PermissionFlagsBits.BanMembers),
  );
});

test("purge, mute, and slowmode enforce safe Discord-side limits", () => {
  const commands = moderationCommands.map((command) => command.toJSON());
  const purge = commands.find((command) => command.name === "purge");
  const mute = commands.find((command) => command.name === "mute");
  const slowmode = commands.find((command) => command.name === "slowmode");

  assert.equal(purge.options[0].max_length, 3);
  assert.equal(
    mute.options.find((option) => option.name === "duration-minutes").max_value,
    40_320,
  );
  assert.equal(
    slowmode.options.find((option) => option.name === "seconds").max_value,
    21_600,
  );
});
