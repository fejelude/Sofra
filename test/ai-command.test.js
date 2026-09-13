import test from "node:test";
import assert from "node:assert/strict";
import { PermissionFlagsBits } from "discord.js";
import { aiCommand } from "../src/ai/command.js";

test("/ai provides channel configuration, disable, and status controls", () => {
  const command = aiCommand.toJSON();
  assert.equal(command.name, "ai");
  assert.equal(command.dm_permission, false);
  assert.equal(command.default_member_permissions, String(PermissionFlagsBits.ManageGuild));
  assert.deepEqual(command.options.map((option) => option.name), ["channel", "disable", "status"]);
  assert.equal(command.options[0].options[0].name, "channel");
  assert.equal(command.options[0].options[0].required, true);
});
