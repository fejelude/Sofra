import test from "node:test";
import assert from "node:assert/strict";
import { PermissionFlagsBits } from "discord.js";
import { autoRoleCommand } from "../src/autorole/command.js";

test("/autorole exposes only the focused administrative commands", () => {
  const command = autoRoleCommand.toJSON();

  assert.equal(command.name, "autorole");
  assert.equal(command.dm_permission, false);
  assert.equal(command.default_member_permissions, String(PermissionFlagsBits.ManageGuild));
  assert.deepEqual(
    command.options.map((option) => option.name),
    ["role", "enable", "disable", "test", "status"],
  );
  assert.equal(command.options[0].options[0].required, true);
});
