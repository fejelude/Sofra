import { levelCommand } from "./level/command.js";
import { welcomeCommand } from "./welcome/command.js";

const commandsToRegister = Object.freeze([welcomeCommand, levelCommand]);

async function upsertCommands(manager, scope, logger) {
  const commands = await manager.fetch();
  const failures = [];

  for (const commandBuilder of commandsToRegister) {
    const existing = commands.find((command) => command.name === commandBuilder.name);
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

  if (failures.length > 0) {
    throw new AggregateError(failures, "One or more application commands failed.");
  }
}

export async function registerCommands(client, guildId, logger) {
  if (guildId) {
    const guild = await client.guilds.fetch(guildId);
    await upsertCommands(
      guild.commands,
      `for the configured server (${guildId})`,
      logger,
    );
    return;
  }

  if (!client.application) {
    throw new Error("Discord application data was unavailable after the ready event.");
  }

  await upsertCommands(client.application.commands, "globally", logger);
}
