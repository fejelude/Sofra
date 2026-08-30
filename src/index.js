import { Client, Events, GatewayIntentBits } from "discord.js";
import { AutoRoleService } from "./autorole/service.js";
import { AutomodService } from "./automod/service.js";
import { BoosterService } from "./booster/service.js";
import { CommunityService } from "./community/service.js";
import { LevelService } from "./level/service.js";
import { LevelStore } from "./level/store.js";
import { logger } from "./logger.js";
import { ModLogService } from "./modlog/service.js";
import { ModerationService } from "./moderation/service.js";
import { registerCommands } from "./register-command.js";
import { readRuntimeConfig } from "./runtime-config.js";
import { SofhiaEasterEggService } from "./sofhia/service.js";
import { TicketService } from "./ticket/service.js";
import { WelcomeService } from "./welcome/service.js";
import { JsonWelcomeConfigStore } from "./welcome/store.js";

const runtime = readRuntimeConfig();
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration,
  ],
});
const store = new JsonWelcomeConfigStore({
  filePath: runtime.storePath,
  logger,
});
const welcomeService = new WelcomeService({ client, store, logger });
const levelStore = new LevelStore({
  filePath: runtime.levelDatabasePath,
  logger,
});
const levelService = new LevelService({ client, store: levelStore, logger });
const autoRoleService = new AutoRoleService({
  client,
  store: levelStore,
  logger,
});
const boosterService = new BoosterService({ client, store: levelStore, logger });
const sofhiaEasterEggService = new SofhiaEasterEggService({ logger });
const modLogService = new ModLogService({
  client,
  store: levelStore,
  logger,
});
const moderationService = new ModerationService({
  client,
  store: levelStore,
  logger,
  modLogService,
});
const automodService = new AutomodService({ client, store: levelStore, logger, modLogService });
const communityService = new CommunityService({ client, logger });
const ticketService = new TicketService({
  client,
  store: levelStore,
  logger,
  modLogService,
});

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
  levelStore.close();
  client.destroy();
  process.exit(1);
});

async function shutdown(signal) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  logger.info("SHUTDOWN", `Received ${signal}; closing the Discord connection.`);
  levelStore.close();
  client.destroy();
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

client.once(Events.ClientReady, (readyClient) => {
  logger.info("BOT_READY", `Logged in as ${readyClient.user.tag}.`, {
    guildCount: readyClient.guilds.cache.size,
  });

  void registerCommands(readyClient, runtime.guildId, logger).catch((error) => {
    logger.error(
      "COMMAND_REGISTRATION_FAILED",
      "Sofra is online, but one or more commands could not be registered. Check the bot token, application command scope, and DISCORD_GUILD_ID.",
      error,
      { guildId: runtime.guildId },
    );
  });
});

client.on(Events.InteractionCreate, (interaction) => {
  void (async () => {
    if (await welcomeService.handleInteraction(interaction)) {
      return;
    }
    if (await levelService.handleInteraction(interaction)) {
      return;
    }
    if (await autoRoleService.handleInteraction(interaction)) {
      return;
    }
    if (await boosterService.handleInteraction(interaction)) {
      return;
    }
    if (await modLogService.handleInteraction(interaction)) {
      return;
    }
    if (await ticketService.handleInteraction(interaction)) {
      return;
    }
    if (await moderationService.handleInteraction(interaction)) {
      return;
    }
    if (await automodService.handleInteraction(interaction)) {
      return;
    }
    await communityService.handleInteraction(interaction);
  })();
});

client.on(Events.GuildMemberAdd, (member) => {
  void welcomeService.handleMemberJoin(member);
  void autoRoleService.handleMemberJoin(member);
});

client.on(Events.GuildMemberUpdate, (oldMember, newMember) => {
  void boosterService.handleMemberUpdate(oldMember, newMember);
});

client.on(Events.MessageCreate, (message) => {
  void automodService.handleMessage(message);
  void levelService.handleMessage(message);
  void sofhiaEasterEggService.handleMessage(message);
});

client.on(Events.GuildRoleDelete, (role) => {
  levelService.handleRoleDelete(role);
  autoRoleService.handleRoleDelete(role);
  boosterService.handleRoleDelete(role);
});

client.on(Events.ChannelDelete, (channel) => {
  void moderationService.handleChannelDelete(channel);
  void modLogService.handleChannelDelete(channel);
  void ticketService.handleChannelDelete(channel);
  boosterService.handleChannelDelete(channel);
});

client.on(Events.GuildAuditLogEntryCreate, (entry, guild) => {
  void modLogService.handleAuditLogEntry(entry, guild);
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
  });
});

client.on("warn", (warning) => {
  logger.warn("DISCORD_WARNING", warning);
});

async function main() {
  await Promise.all([store.init(), levelStore.init()]);
  logger.info("WELCOME_STORE_READY", store.getHealth().message, {
    healthy: store.getHealth().ok,
  });
  logger.info("LEVEL_STORE_READY", levelStore.getHealth().message, {
    healthy: levelStore.getHealth().ok,
  });

  logger.info("BOT_STARTING", "Connecting Sofra to Discord.");
  await client.login(runtime.token);
}

await main();
