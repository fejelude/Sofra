import { welcomeCommand } from "./welcome/command.js";

async function upsertCommand(manager) {
  const commands = await manager.fetch();
  const existing = commands.find((command) => command.name === welcomeCommand.name);
  const commandData = welcomeCommand.toJSON();

  if (existing) {
    await existing.edit(commandData);
    return "updated";
  }

  await manager.create(commandData);
  return "created";
}

export async function registerWelcomeCommand(client, guildId, logger) {
  if (guildId) {
    const guild = await client.guilds.fetch(guildId);
    const action = await upsertCommand(guild.commands);
    logger.info(
      "COMMAND_REGISTERED",
      `/welcome ${action} for the configured development server.`,
      { guildId },
    );
    return;
  }

  if (!client.application) {
    throw new Error("Discord application data was unavailable after the ready event.");
  }

  const action = await upsertCommand(client.application.commands);
  logger.info("COMMAND_REGISTERED", `/welcome ${action} globally.`);
}
