import test from "node:test";
import assert from "node:assert/strict";
import {
  commandsToRegister,
  reconcileCommands,
} from "../src/register-command.js";

test("Sofra exposes only eight top-level Discord commands", () => {
  assert.deepEqual(
    commandsToRegister.map((command) => command.name),
    ["sofra", "level", "purge", "mod", "info", "embed", "poll", "meme"],
  );
});

test("command reconciliation deletes stale Discord commands", async () => {
  const deleted = [];
  const edited = [];
  const created = [];
  const existing = [
    {
      name: "sofra",
      edit: async (data) => edited.push(data.name),
      delete: async () => deleted.push("sofra"),
    },
    {
      name: "automod",
      edit: async () => {},
      delete: async () => deleted.push("automod"),
    },
    {
      name: "welcome",
      edit: async () => {},
      delete: async () => deleted.push("welcome"),
    },
  ];

  const manager = {
    fetch: async () => existing,
    create: async (data) => created.push(data.name),
  };
  const logger = { info() {}, error() {} };

  await reconcileCommands(manager, "in test", logger);

  assert.deepEqual(deleted.sort(), ["automod", "welcome"]);
  assert.deepEqual(edited, ["sofra"]);
  assert.deepEqual(
    created.sort(),
    ["embed", "info", "level", "meme", "mod", "poll", "purge"].sort(),
  );
});
