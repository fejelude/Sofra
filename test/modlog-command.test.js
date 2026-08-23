import test from "node:test";
import assert from "node:assert/strict";
import { PermissionFlagsBits } from "discord.js";
import { modLogCommand } from "../src/modlog/command.js";

test("modlog exposes the complete administrator setup workflow", () => {
  const command = modLogCommand.toJSON();
  assert.equal(command.name, "modlog");
  assert.equal(command.dm_permission, false);
  assert.equal(
    BigInt(command.default_member_permissions),
    PermissionFlagsBits.ManageGuild,
  );
  assert.deepEqual(
    command.options.map((option) => option.name),
    ["setup", "channel", "enable", "disable", "test", "status"],
  );
  assert.equal(
    command.options.find((option) => option.name === "channel").options[0].required,
    true,
  );
});
