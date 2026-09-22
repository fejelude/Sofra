import test from "node:test";
import assert from "node:assert/strict";
import { OnboardingService, onboardingCommands } from "../src/onboarding.js";
test("onboarding registers public help and permission-gated setup/health", () => {
  const commands = onboardingCommands.map((command) => command.toJSON());
  assert.deepEqual(commands.map((command) => command.name), ['help', 'setup', 'health']);
  assert.equal(commands[0].default_member_permissions, undefined);
  assert.equal(commands[1].default_member_permissions, '32');
  assert.equal(commands[2].default_member_permissions, '32');
});
test("setup is guarded again at execution, not only registration", async () => {
  let response;
  const service = new OnboardingService({});
  const interaction = { isChatInputCommand: () => true, commandName: 'setup', inGuild: () => true, guild: { ownerId: 'owner' }, user: { id: 'member' }, memberPermissions: { has: () => false }, reply: async (value) => { response = value; } };
  assert.equal(await service.handleInteraction(interaction), true);
  assert.match(response.content, /Manage Server/);
  assert.equal(response.flags, 64);
});
