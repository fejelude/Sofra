import { loadEnvFile } from "node:process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SNOWFLAKE_PATTERN = /^\d{17,20}$/;
const CONFIG_ENVIRONMENT_KEYS = [
  "DISCORD_TOKEN",
  "DISCORD_GUILD_ID",
  "WELCOME_CONFIG_PATH",
];
const DEFAULT_STORE_PATH = fileURLToPath(
  new URL("../data/welcome-config.json", import.meta.url),
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

export function readRuntimeConfig() {
  loadOptionalDotEnv();

  const token = process.env.DISCORD_TOKEN?.trim();
  if (!token) {
    throw new Error(
      "DISCORD_TOKEN is missing. Add it to Wispbyte's environment variables before starting Sofra.",
    );
  }

  const configuredPath = process.env.WELCOME_CONFIG_PATH?.trim();

  return Object.freeze({
    token,
    guildId: optionalSnowflake("DISCORD_GUILD_ID"),
    storePath: configuredPath ? resolve(process.cwd(), configuredPath) : DEFAULT_STORE_PATH,
  });
}
