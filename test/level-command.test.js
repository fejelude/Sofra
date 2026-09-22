import test from "node:test";
import assert from "node:assert/strict";
import { levelCommand } from "../src/level/command.js";

test("/level is one public rank entry point instead of a subcommand tree", () => {
  const command = levelCommand.toJSON();
  assert.equal(command.name, "level");
  assert.equal(command.dm_permission, false);
  assert.equal(command.default_member_permissions, undefined);
  assert.deepEqual(command.options.map((option) => option.name), ["member"]);
  assert.equal(command.options[0].required, false);
});
