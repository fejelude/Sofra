import test from "node:test";
import assert from "node:assert/strict";
import { welcomeCommand } from "../src/welcome/command.js";
import { WELCOME_MESSAGES } from "../src/welcome/messages.js";
import { SUPPORTED_PLACEHOLDERS } from "../src/welcome/template.js";

test("welcome pool contains 50–75 unique, complete messages", () => {
  assert.ok(WELCOME_MESSAGES.length >= 50);
  assert.ok(WELCOME_MESSAGES.length <= 75);
  assert.equal(new Set(WELCOME_MESSAGES).size, WELCOME_MESSAGES.length);

  for (const message of WELCOME_MESSAGES) {
    assert.ok(message.length > 60, "each entry should be a complete welcome");
    assert.ok(message.length < 1_000, "each entry must fit comfortably in an embed");
    assert.match(message, /\{user\.(?:mention|name)\}/);

    const placeholders = message.match(/\{[^}]+\}/g) ?? [];
    for (const placeholder of placeholders) {
      assert.ok(
        SUPPORTED_PLACEHOLDERS.includes(placeholder),
        `unsupported placeholder: ${placeholder}`,
      );
    }
  }
});

test("/welcome exposes only the requested admin subcommands", () => {
  const command = welcomeCommand.toJSON();
  const subcommands = command.options.map((option) => option.name);

  assert.equal(command.name, "welcome");
  assert.equal(command.default_member_permissions, "32");
  assert.equal(command.dm_permission, false);
  assert.deepEqual(subcommands, ["channel", "enable", "disable", "test", "status"]);

  const channelOption = command.options[0].options[0];
  assert.equal(channelOption.required, true);
  assert.deepEqual(channelOption.channel_types, [0, 5]);
});
