import test from "node:test";
import assert from "node:assert/strict";
import { PermissionFlagsBits } from "discord.js";
import { moderationCommands } from "../src/moderation/commands.js";

test("moderation exposes only /purge and the consolidated /mod command", () => {
  const commands = moderationCommands.map((command) => command.toJSON());
  assert.deepEqual(commands.map((command) => command.name), ["purge", "mod"]);
  assert.ok(commands.every((command) => command.dm_permission === false));
  assert.equal(
    commands.find((command) => command.name === "purge").default_member_permissions,
    String(PermissionFlagsBits.ManageMessages),
  );
  assert.equal(
    commands.find((command) => command.name === "mod").default_member_permissions,
    undefined,
  );

  const mod = commands.find((command) => command.name === "mod");
  assert.deepEqual(
    mod.options.find((option) => option.name === "action").choices.map((choice) => choice.value),
    [
      "warn",
      "warnings",
      "mute",
      "unmute",
      "kick",
      "ban",
      "unban",
      "lockdown",
      "unlock",
      "slowmode",
    ],
  );
});

test("/purge and /mod keep Discord-side safety limits", () => {
  const commands = moderationCommands.map((command) => command.toJSON());
  const purge = commands.find((command) => command.name === "purge");
  const mod = commands.find((command) => command.name === "mod");

  assert.equal(purge.options[0].max_length, 3);
  assert.equal(
    mod.options.find((option) => option.name === "duration-minutes").max_value,
    40_320,
  );
  assert.equal(
    mod.options.find((option) => option.name === "seconds").max_value,
    21_600,
  );
  assert.equal(
    mod.options.find((option) => option.name === "delete-message-days").max_value,
    7,
  );
});
