import test from "node:test";
import assert from "node:assert/strict";
import { ApplicationCommandOptionType, PermissionFlagsBits } from "discord.js";
import { ticketChannelCommand } from "../src/ticket/command.js";

test("ticket-channel exposes panel, category, roles, and shared Staff Logs configuration", () => {
  const command = ticketChannelCommand.toJSON();
  assert.equal(command.name, "ticket-channel");
  assert.equal(command.dm_permission, false);
  assert.equal(BigInt(command.default_member_permissions), PermissionFlagsBits.ManageGuild);
  assert.deepEqual(command.options.map((option) => option.name), [
    "panel-channel",
    "ticket-category",
    "staff-role",
    "staff-role-2",
    "staff-role-3",
    "staff-role-4",
    "staff-role-5",
    "staff-logs",
  ]);
  assert.equal(command.options[0].required, true);
  assert.equal(command.options[1].required, true);
  assert.equal(command.options[2].required, true);
  assert.equal(command.options[2].type, ApplicationCommandOptionType.Role);
});
