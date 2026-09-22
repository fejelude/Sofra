import test from "node:test";
import assert from "node:assert/strict";
import { OnboardingService, onboardingCommands } from "../src/onboarding.js";

test("onboarding registers a single public /sofra control center", () => {
  const commands = onboardingCommands.map((command) => command.toJSON());
  assert.deepEqual(commands.map((command) => command.name), ["sofra"]);
  assert.equal(commands[0].default_member_permissions, undefined);
  assert.deepEqual(
    commands[0].options[0].choices.map((choice) => choice.value),
    ["home", "setup", "health"],
  );
});

test("setup and health stay permission-gated at execution time", async () => {
  let response;
  const service = new OnboardingService({});
  const interaction = {
    isChatInputCommand: () => true,
    isButton: () => false,
    commandName: "sofra",
    inGuild: () => true,
    guild: { ownerId: "owner" },
    user: { id: "member" },
    memberPermissions: { has: () => false },
    options: { getString: () => "setup" },
    reply: async (value) => {
      response = value;
    },
  };

  assert.equal(await service.handleInteraction(interaction), true);
  assert.match(response.content, /Manage Server/);
  assert.equal(response.flags, 64);
});
