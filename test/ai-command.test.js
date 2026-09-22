import test from "node:test";
import assert from "node:assert/strict";
import { PermissionFlagsBits } from "discord.js";
import { aiCommand } from "../src/ai/command.js";

test("/ai stays one command while preserving status, channel, and disable actions", () => {
  const command = aiCommand.toJSON();
  assert.equal(command.name, "ai");
  assert.equal(command.dm_permission, false);
  assert.equal(command.default_member_permissions, String(PermissionFlagsBits.ManageGuild));
  assert.deepEqual(command.options.map((option) => option.name), ["action", "channel"]);
  assert.deepEqual(
    command.options[0].choices.map((choice) => choice.value),
    ["status", "channel", "disable"],
  );
  assert.equal(command.options[1].required, false);
});
