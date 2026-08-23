import { Client, Events, GatewayIntentBits } from "discord.js";
import { logger } from "./logger.js";
import { registerWelcomeCommand } from "./register-command.js";
import { readRuntimeConfig } from "./runtime-config.js";
import { WelcomeService } from "./welcome/service.js";
import { JsonWelcomeConfigStore } from "./welcome/store.js";

const runtime = readRuntimeConfig();
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});
const store = new JsonWelcomeConfigStore({
  filePath: runtime.storePath,
  logger,
});
const welcomeService = new WelcomeService({ client, store, logger });

let shuttingDown = false;

process.on("unhandledRejection", (error) => {
  logger.error(
    "UNHANDLED_REJECTION",
    "An unhandled promise rejection occurred.",
    error,
  );
});

process.on("uncaughtException", (error) => {
  logger.error(
    "UNCAUGHT_EXCEPTION",
    "An unrecoverable exception occurred; Wispbyte should restart Sofra.",
    error,
  );
  client.destroy();
  process.exit(1);
});

async function shutdown(signal) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  logger.info("SHUTDOWN", `Received ${signal}; closing the Discord connection.`);
  client.destroy();
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

client.once(Events.ClientReady, (readyClient) => {
  logger.info("BOT_READY", `Logged in as ${readyClient.user.tag}.`, {
    guildCount: readyClient.guilds.cache.size,
  });

  void registerWelcomeCommand(readyClient, runtime.guildId, logger).catch((error) => {
    logger.error(
      "COMMAND_REGISTRATION_FAILED",
      "Sofra is online, but /welcome could not be registered. Check the bot token, application command scope, and DISCORD_GUILD_ID.",
      error,
      { guildId: runtime.guildId },
    );
  });
});

client.on(Events.InteractionCreate, (interaction) => {
  void welcomeService.handleInteraction(interaction);
});

client.on(Events.GuildMemberAdd, (member) => {
  void welcomeService.handleMemberJoin(member);
});

client.on(Events.Error, (error) => {
  logger.error("DISCORD_CLIENT_ERROR", "The Discord client emitted an error.", error);
});

client.on(Events.ShardError, (error, shardId) => {
  logger.error("DISCORD_SHARD_ERROR", "A Discord gateway shard emitted an error.", error, {
    shardId,
  });
});

client.on(Events.ShardDisconnect, (event, shardId) => {
  logger.warn("DISCORD_SHARD_DISCONNECTED", "A Discord gateway shard disconnected.", {
    shardId,
    code: event.code,
    reason: event.reason || "No reason supplied",
  });
});

client.on("warn", (warning) => {
  logger.warn("DISCORD_WARNING", warning);
});

async function main() {
  await store.init();
  logger.info("WELCOME_STORE_READY", store.getHealth().message, {
    healthy: store.getHealth().ok,
  });

  logger.info("BOT_STARTING", "Connecting Sofra to Discord.");
  await client.login(runtime.token);
}

await main();
