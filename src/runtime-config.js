import { loadEnvFile } from "node:process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SNOWFLAKE_PATTERN = /^\d{17,20}$/;
const CONFIG_ENVIRONMENT_KEYS = [
  "DISCORD_TOKEN",
  "DISCORD_GUILD_ID",
  "WELCOME_CONFIG_PATH",
  "LEVEL_DATABASE_PATH",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "SOFRA_CONFIG_POLL_MS",
];
const DEFAULT_STORE_PATH = fileURLToPath(
  new URL("../data/welcome-config.json", import.meta.url),
);
const DEFAULT_LEVEL_DATABASE_PATH = fileURLToPath(
  new URL("../data/levels.sqlite", import.meta.url),
);

function loadOptionalDotEnv() {
  const injectedValues = new Map(
    CONFIG_ENVIRONMENT_KEYS.filter((key) => process.env[key] !== undefined).map((key) => [
      key,
      process.env[key],
    ]),
  );

  try {
    loadEnvFile();
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw new Error(`Unable to load .env: ${error.message}`, { cause: error });
    }
  }

  // Wispbyte-injected variables always win over an optional local .env file.
  for (const [key, value] of injectedValues) {
    process.env[key] = value;
  }
}

function optionalSnowflake(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    return null;
  }

  if (!SNOWFLAKE_PATTERN.test(value)) {
    throw new Error(`${name} must be a valid Discord ID containing 17–20 digits.`);
  }

  return value;
}

function sharedConfigPollMs() {
  const raw = process.env.SOFRA_CONFIG_POLL_MS?.trim();
  if (!raw) return 4_000;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 2_000 || value > 60_000) {
    throw new Error("SOFRA_CONFIG_POLL_MS must be an integer from 2000 to 60000 milliseconds.");
  }
  return value;
}

export function readRuntimeConfig() {
  loadOptionalDotEnv();

  const token = process.env.DISCORD_TOKEN?.trim();
  if (!token) {
    throw new Error(
      "DISCORD_TOKEN is missing. Add it to Wispbyte's environment variables before starting Sofra.",
    );
  }

  const configuredPath = process.env.WELCOME_CONFIG_PATH?.trim();
  const configuredLevelDatabasePath = process.env.LEVEL_DATABASE_PATH?.trim();
  const sharedConfigUrl = process.env.UPSTASH_REDIS_REST_URL?.trim() ?? "";
  const sharedConfigToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim() ?? "";

  if (Boolean(sharedConfigUrl) !== Boolean(sharedConfigToken)) {
    throw new Error(
      "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must either both be configured or both be omitted.",
    );
  }

  return Object.freeze({
    token,
    guildId: optionalSnowflake("DISCORD_GUILD_ID"),
    storePath: configuredPath ? resolve(process.cwd(), configuredPath) : DEFAULT_STORE_PATH,
    levelDatabasePath: configuredLevelDatabasePath
      ? resolve(process.cwd(), configuredLevelDatabasePath)
      : DEFAULT_LEVEL_DATABASE_PATH,
    sharedConfig: Object.freeze({
      url: sharedConfigUrl,
      token: sharedConfigToken,
      pollMs: sharedConfigPollMs(),
    }),
  });
}
