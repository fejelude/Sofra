import {
  mkdir,
  readFile,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import { dirname } from "node:path";

const STORE_VERSION = 1;
const SNOWFLAKE_PATTERN = /^\d{17,20}$/;
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const WRITE_ATTEMPTS = 3;

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function plainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function optionalString(value, maximumLength) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maximumLength) : null;
}

function copyConfig(config) {
  const color = typeof config?.color === "string" && HEX_COLOR_PATTERN.test(config.color)
    ? config.color.toLowerCase()
    : null;
  return Object.freeze({
    enabled: config?.enabled === true,
    channelId: config?.channelId ?? null,
    messageTemplate: optionalString(config?.messageTemplate, 1_800),
    embedTitle: optionalString(config?.embedTitle, 256),
    embedDescription: optionalString(config?.embedDescription, 4_000),
    color,
    imageUrl: optionalString(config?.imageUrl, 500),
    thumbnailMode: config?.thumbnailMode === "none" ? "none" : "member",
  });
}

function readDocument(raw) {
  const parsed = JSON.parse(raw);
  if (!plainObject(parsed) || parsed.version !== STORE_VERSION || !plainObject(parsed.guilds)) {
    throw new Error("The configuration document has an unsupported or malformed shape.");
  }

  const guilds = new Map();
  const issues = [];

  for (const [guildId, config] of Object.entries(parsed.guilds)) {
    if (
      !SNOWFLAKE_PATTERN.test(guildId) ||
      !plainObject(config) ||
      typeof config.enabled !== "boolean" ||
      (config.channelId !== null && config.channelId !== undefined && !SNOWFLAKE_PATTERN.test(config.channelId))
    ) {
      issues.push(guildId);
      continue;
    }

    guilds.set(guildId, copyConfig(config));
  }

  return { guilds, issues };
}

function createDocument(guilds) {
  const entries = [...guilds.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([guildId, config]) => [guildId, copyConfig(config)]);

  return {
    version: STORE_VERSION,
    guilds: Object.fromEntries(entries),
  };
}

function validateCustomization(customization) {
  if (!plainObject(customization)) {
    throw new Error("Welcome customization must be an object.");
  }

  const limits = [
    ["messageTemplate", 1_800],
    ["embedTitle", 256],
    ["embedDescription", 4_000],
    ["imageUrl", 500],
  ];
  for (const [key, maximumLength] of limits) {
    const value = customization[key];
    if (value !== null && value !== undefined && typeof value !== "string") {
      throw new Error(`${key} must be text or null.`);
    }
    if (typeof value === "string" && value.length > maximumLength) {
      throw new Error(`${key} is too long.`);
    }
  }

  if (
    customization.color !== null &&
    customization.color !== undefined &&
    (typeof customization.color !== "string" || !HEX_COLOR_PATTERN.test(customization.color))
  ) {
    throw new Error("Welcome color must be a six-digit hex color such as #f4a7c2.");
  }
  if (
    customization.thumbnailMode !== undefined &&
    !["member", "none"].includes(customization.thumbnailMode)
  ) {
    throw new Error("Welcome thumbnail mode must be member or none.");
  }

  if (customization.imageUrl) {
    let parsed;
    try {
      parsed = new URL(customization.imageUrl);
    } catch {
      throw new Error("Welcome image URL must be a valid HTTPS URL.");
    }
    if (parsed.protocol !== "https:") {
      throw new Error("Welcome image URL must use HTTPS.");
    }
  }
}

export class JsonWelcomeConfigStore {
  constructor({ filePath, logger }) {
    this.filePath = filePath;
    this.logger = logger;
    this.guilds = new Map();
    this.writeQueue = Promise.resolve();
    this.health = Object.freeze({ ok: true, message: "Configuration storage is ready." });
  }

  async init() {
    let raw;

    try {
      raw = await this.readWithRetry();
    } catch (error) {
      if (error?.code === "ENOENT") {
        this.health = Object.freeze({
          ok: true,
          message: "Configuration storage is ready; no settings have been saved yet.",
        });
        return;
      }

      this.health = Object.freeze({
        ok: false,
        message: "The configuration file could not be read. Reconfigure a channel to repair it.",
      });
      this.logger.error(
        "WELCOME_STORE_READ_FAILED",
        "Welcome configuration could not be loaded; Sofra will stay online with welcomes paused.",
        error,
        { filePath: this.filePath },
      );
      return;
    }

    try {
      const { guilds, issues } = readDocument(raw);
      this.guilds = guilds;

      if (issues.length > 0) {
        this.health = Object.freeze({
          ok: false,
          message: `${issues.length} malformed server configuration entr${
            issues.length === 1 ? "y was" : "ies were"
          } ignored. Saving a valid setting will repair the file.`,
        });
        this.logger.warn(
          "WELCOME_STORE_PARTIAL",
          "Malformed welcome configuration entries were ignored.",
          { invalidEntryCount: issues.length },
        );
      }
    } catch (error) {
      this.guilds = new Map();
      this.health = Object.freeze({
        ok: false,
        message: "The configuration file is malformed. Reconfigure a channel to repair it.",
      });
      this.logger.error(
        "WELCOME_STORE_INVALID",
        "Welcome configuration is malformed; Sofra will stay online with welcomes paused.",
        error,
        { filePath: this.filePath },
      );
    }
  }

  getGuildConfig(guildId) {
    return copyConfig(this.guilds.get(guildId));
  }

  getHealth() {
    return this.health;
  }

  setChannel(guildId, channelId) {
    if (
      !SNOWFLAKE_PATTERN.test(guildId) ||
      (channelId !== null && !SNOWFLAKE_PATTERN.test(channelId))
    ) {
      return Promise.reject(new Error("A valid Discord server and channel ID are required."));
    }

    return this.updateGuild(guildId, (current) => ({ ...current, channelId }));
  }

  setEnabled(guildId, enabled) {
    if (!SNOWFLAKE_PATTERN.test(guildId) || typeof enabled !== "boolean") {
      return Promise.reject(new Error("A valid Discord server ID and enabled state are required."));
    }

    return this.updateGuild(guildId, (current) => ({ ...current, enabled }));
  }

  setCustomization(guildId, customization) {
    if (!SNOWFLAKE_PATTERN.test(guildId)) {
      return Promise.reject(new Error("A valid Discord server ID is required."));
    }

    try {
      validateCustomization(customization);
    } catch (error) {
      return Promise.reject(error);
    }

    return this.updateGuild(guildId, (current) => ({
      ...current,
      messageTemplate: customization.messageTemplate ?? null,
      embedTitle: customization.embedTitle ?? null,
      embedDescription: customization.embedDescription ?? null,
      color: customization.color ?? null,
      imageUrl: customization.imageUrl ?? null,
      thumbnailMode: customization.thumbnailMode ?? "member",
    }));
  }

  updateGuild(guildId, update) {
    const task = this.writeQueue.then(async () => {
      const current = this.getGuildConfig(guildId);
      const next = copyConfig(update(current));
      const nextGuilds = new Map(this.guilds);
      nextGuilds.set(guildId, next);

      await this.persistWithRetry(nextGuilds);
      this.guilds = nextGuilds;
      this.health = Object.freeze({ ok: true, message: "Configuration storage is ready." });
      return next;
    });

    this.writeQueue = task.catch(() => undefined);
    return task;
  }

  async readWithRetry() {
    let lastError;

    for (let attempt = 1; attempt <= WRITE_ATTEMPTS; attempt += 1) {
      try {
        return await readFile(this.filePath, "utf8");
      } catch (error) {
        lastError = error;
        if (error?.code === "ENOENT" || attempt === WRITE_ATTEMPTS) {
          throw error;
        }
        await wait(attempt * 75);
      }
    }

    throw lastError;
  }

  async persistWithRetry(guilds) {
    let lastError;

    for (let attempt = 1; attempt <= WRITE_ATTEMPTS; attempt += 1) {
      const temporaryPath = `${this.filePath}.${process.pid}.${Date.now()}.${attempt}.tmp`;

      try {
        await mkdir(dirname(this.filePath), { recursive: true });
        const serialized = `${JSON.stringify(createDocument(guilds), null, 2)}\n`;
        await writeFile(temporaryPath, serialized, { encoding: "utf8", mode: 0o600 });
        await rename(temporaryPath, this.filePath);
        return;
      } catch (error) {
        lastError = error;
        await unlink(temporaryPath).catch(() => undefined);

        if (attempt < WRITE_ATTEMPTS) {
          await wait(attempt * 100);
        }
      }
    }

    this.health = Object.freeze({
      ok: false,
      message: "Configuration changes cannot currently be saved. Check the Wispbyte console.",
    });
    this.logger.error(
      "WELCOME_STORE_WRITE_FAILED",
      "A welcome configuration change could not be persisted after retries.",
      lastError,
      { filePath: this.filePath, attempts: WRITE_ATTEMPTS },
    );
    throw new Error("The welcome configuration could not be saved.", { cause: lastError });
  }
}
