import { aiCommand } from "./ai/command.js";
import { communityCommands } from "./community/commands.js";
import { levelCommand } from "./level/command.js";
import { moderationCommands } from "./moderation/commands.js";
import { onboardingCommands } from "./onboarding.js";
import { ticketChannelCommand } from "./ticket/command.js";

export const commandsToRegister = Object.freeze([
  ...onboardingCommands,
  levelCommand,
  ...moderationCommands,
  ...communityCommands,
  aiCommand,
  ticketChannelCommand,
]);

function commandList(commands) {
  if (Array.isArray(commands)) return commands;
  if (typeof commands?.values === "function") return [...commands.values()];
  return [...commands];
}

export async function reconcileCommands(manager, scope, logger) {
  const existingCommands = commandList(await manager.fetch());
  const desiredNames = new Set(commandsToRegister.map((command) => command.name));
  const failures = [];

  for (const commandBuilder of commandsToRegister) {
    const existing = existingCommands.find(
      (command) => command.name === commandBuilder.name,
    );
    const commandData = commandBuilder.toJSON();

    try {
      if (existing) {
        await existing.edit(commandData);
      } else {
        await manager.create(commandData);
      }

      logger.info(
        "COMMAND_REGISTERED",
        `/${commandBuilder.name} ${existing ? "updated" : "created"} ${scope}.`,
      );
    } catch (error) {
      failures.push(error);
      logger.error(
        "COMMAND_REGISTRATION_ITEM_FAILED",
        `/${commandBuilder.name} could not be registered ${scope}.`,
        error,
      );
    }
  }

  for (const existing of existingCommands) {
    if (desiredNames.has(existing.name)) continue;

    try {
      await existing.delete();
      logger.info(
        "COMMAND_REMOVED",
        `/${existing.name} removed ${scope}; it is no longer part of Sofra's public command surface.`,
      );
    } catch (error) {
      failures.push(error);
      logger.error(
        "COMMAND_REMOVAL_FAILED",
        `/${existing.name} could not be removed ${scope}.`,
        error,
      );
    }
  }

  if (failures.length > 0) {
    throw new AggregateError(
      failures,
      "One or more application commands could not be reconciled.",
    );
  }
}

export async function registerCommands(client, guildId, logger) {
  if (guildId) {
    const guild = await client.guilds.fetch(guildId);
    await reconcileCommands(
      guild.commands,
      `for the configured server (${guildId})`,
      logger,
    );
    return;
  }

  if (!client.application) {
    throw new Error("Discord application data was unavailable after the ready event.");
  }

  await reconcileCommands(client.application.commands, "globally", logger);
}
