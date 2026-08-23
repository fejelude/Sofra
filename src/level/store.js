import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import {
  DEFAULT_COOLDOWN_SECONDS,
  DEFAULT_XP_MAX,
  DEFAULT_XP_MIN,
  MAX_TOTAL_XP,
} from "./math.js";

const SCHEMA_VERSION = 4;
const SNOWFLAKE_PATTERN = /^\d{17,20}$/;
const MAX_WARNING_HISTORY_PER_MEMBER = 25;

function defaultConfig(guildId) {
  return Object.freeze({
    guildId,
    enabled: false,
    notificationChannelId: null,
    xpMin: DEFAULT_XP_MIN,
    xpMax: DEFAULT_XP_MAX,
    cooldownSeconds: DEFAULT_COOLDOWN_SECONDS,
  });
}

function mapConfig(row, guildId) {
  if (!row) {
    return defaultConfig(guildId);
  }

  return Object.freeze({
    guildId,
    enabled: row.enabled === 1,
    notificationChannelId: row.notification_channel_id ?? null,
    xpMin: row.xp_min,
    xpMax: row.xp_max,
    cooldownSeconds: row.cooldown_seconds,
  });
}

function mapAutoRoleConfig(row, guildId) {
  return Object.freeze({
    guildId,
    enabled: row?.enabled === 1,
    roleId: row?.role_id ?? null,
  });
}

function mapModLogConfig(row, guildId) {
  return Object.freeze({
    guildId,
    enabled: row?.enabled === 1,
    channelId: row?.channel_id ?? null,
  });
}

function validateSnowflake(value, label) {
  if (!SNOWFLAKE_PATTERN.test(value)) {
    throw new Error(`${label} must be a valid Discord ID.`);
  }
}

function validateInteger(value, minimum, maximum, label) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${label} must be an integer from ${minimum} to ${maximum}.`);
  }
}

export class LevelStore {
  constructor({ filePath, logger }) {
    this.filePath = filePath;
    this.logger = logger;
    this.database = null;
    this.statements = null;
    this.health = Object.freeze({
      ok: false,
      message: "Level storage has not been initialized.",
    });
  }

  async init() {
    let openedDatabase = null;

    try {
      if (this.filePath !== ":memory:") {
        await mkdir(dirname(this.filePath), { recursive: true });
      }

      const { DatabaseSync } = await import("node:sqlite");
      const database = new DatabaseSync(this.filePath, { timeout: 3_000 });
      openedDatabase = database;

      database.exec("PRAGMA foreign_keys = ON");
      database.exec("PRAGMA journal_mode = WAL");
      database.exec("PRAGMA synchronous = NORMAL");
      database.exec("PRAGMA busy_timeout = 3000");
      database.exec("PRAGMA wal_autocheckpoint = 100");
      database.exec("PRAGMA journal_size_limit = 1048576");
      database.exec("PRAGMA temp_store = MEMORY");

      const version = database.prepare("PRAGMA user_version").get().user_version;
      if (version > SCHEMA_VERSION) {
        throw new Error(
          `Level database schema ${version} is newer than supported schema ${SCHEMA_VERSION}.`,
        );
      }

      database.exec(`
        CREATE TABLE IF NOT EXISTS level_guild_config (
          guild_id TEXT PRIMARY KEY,
          enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
          notification_channel_id TEXT,
          xp_min INTEGER NOT NULL DEFAULT ${DEFAULT_XP_MIN} CHECK (xp_min BETWEEN 1 AND 100),
          xp_max INTEGER NOT NULL DEFAULT ${DEFAULT_XP_MAX} CHECK (xp_max BETWEEN 1 AND 100),
          cooldown_seconds INTEGER NOT NULL DEFAULT ${DEFAULT_COOLDOWN_SECONDS}
            CHECK (cooldown_seconds BETWEEN 15 AND 3600),
          updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS level_members (
          guild_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          xp INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
          awarded_messages INTEGER NOT NULL DEFAULT 0 CHECK (awarded_messages >= 0),
          last_awarded_at INTEGER NOT NULL DEFAULT 0,
          last_message_id TEXT,
          PRIMARY KEY (guild_id, user_id)
        );

        CREATE INDEX IF NOT EXISTS level_members_rank_idx
          ON level_members (guild_id, xp DESC, user_id ASC);

        CREATE TABLE IF NOT EXISTS level_role_rewards (
          guild_id TEXT NOT NULL,
          role_id TEXT NOT NULL,
          required_level INTEGER NOT NULL CHECK (required_level BETWEEN 1 AND 1000),
          created_at INTEGER NOT NULL,
          PRIMARY KEY (guild_id, role_id)
        );

        CREATE INDEX IF NOT EXISTS level_role_rewards_level_idx
          ON level_role_rewards (guild_id, required_level ASC, role_id ASC);

        CREATE TABLE IF NOT EXISTS auto_role_config (
          guild_id TEXT PRIMARY KEY,
          enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
          role_id TEXT,
          updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS moderation_warning_totals (
          guild_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          total INTEGER NOT NULL DEFAULT 0 CHECK (total >= 0),
          updated_at INTEGER NOT NULL,
          PRIMARY KEY (guild_id, user_id)
        );

        CREATE TABLE IF NOT EXISTS moderation_warnings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          moderator_id TEXT NOT NULL,
          reason TEXT NOT NULL,
          created_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS moderation_warnings_member_idx
          ON moderation_warnings (guild_id, user_id, created_at DESC, id DESC);

        CREATE TABLE IF NOT EXISTS channel_lockdowns (
          guild_id TEXT NOT NULL,
          channel_id TEXT NOT NULL,
          previous_send_messages INTEGER CHECK (
            previous_send_messages IS NULL OR previous_send_messages IN (0, 1)
          ),
          previous_send_messages_in_threads INTEGER CHECK (
            previous_send_messages_in_threads IS NULL OR
            previous_send_messages_in_threads IN (0, 1)
          ),
          locked_by TEXT NOT NULL,
          locked_at INTEGER NOT NULL,
          PRIMARY KEY (guild_id, channel_id)
        );

        CREATE TABLE IF NOT EXISTS moderation_log_config (
          guild_id TEXT PRIMARY KEY,
          enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
          channel_id TEXT,
          updated_at INTEGER NOT NULL
        );
      `);

      if (version < SCHEMA_VERSION) {
        database.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
      }

      this.database = database;
      openedDatabase = null;
      this.prepareStatements();
      this.health = Object.freeze({
        ok: true,
        message: "Level database is ready.",
      });
    } catch (error) {
      try {
        (openedDatabase ?? this.database)?.close();
      } catch {
        // The original initialization failure is more useful than a close failure.
      }

      this.database = null;
      this.statements = null;
      this.health = Object.freeze({
        ok: false,
        message: "Level storage is unavailable. Check the Wispbyte console.",
      });
      this.logger.error(
        "LEVEL_STORE_INIT_FAILED",
        "The level database could not be initialized; welcome features remain available.",
        error,
        { filePath: this.filePath },
      );
    }
  }

  prepareStatements() {
    this.statements = Object.freeze({
      getConfig: this.database.prepare(`
        SELECT enabled, notification_channel_id, xp_min, xp_max, cooldown_seconds
        FROM level_guild_config
        WHERE guild_id = ?
      `),
      setEnabled: this.database.prepare(`
        INSERT INTO level_guild_config (guild_id, enabled, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(guild_id) DO UPDATE SET
          enabled = excluded.enabled,
          updated_at = excluded.updated_at
      `),
      setChannel: this.database.prepare(`
        INSERT INTO level_guild_config (guild_id, notification_channel_id, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(guild_id) DO UPDATE SET
          notification_channel_id = excluded.notification_channel_id,
          updated_at = excluded.updated_at
      `),
      setSettings: this.database.prepare(`
        INSERT INTO level_guild_config (
          guild_id,
          xp_min,
          xp_max,
          cooldown_seconds,
          updated_at
        ) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(guild_id) DO UPDATE SET
          xp_min = excluded.xp_min,
          xp_max = excluded.xp_max,
          cooldown_seconds = excluded.cooldown_seconds,
          updated_at = excluded.updated_at
      `),
      getMember: this.database.prepare(`
        SELECT xp, awarded_messages, last_awarded_at, last_message_id
        FROM level_members
        WHERE guild_id = ? AND user_id = ?
      `),
      saveMember: this.database.prepare(`
        INSERT INTO level_members (
          guild_id,
          user_id,
          xp,
          awarded_messages,
          last_awarded_at,
          last_message_id
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(guild_id, user_id) DO UPDATE SET
          xp = excluded.xp,
          awarded_messages = excluded.awarded_messages,
          last_awarded_at = excluded.last_awarded_at,
          last_message_id = excluded.last_message_id
      `),
      leaderboard: this.database.prepare(`
        SELECT user_id, xp, awarded_messages
        FROM level_members
        WHERE guild_id = ? AND xp > 0
        ORDER BY xp DESC, user_id ASC
        LIMIT ? OFFSET ?
      `),
      rankedMemberCount: this.database.prepare(`
        SELECT COUNT(*) AS count
        FROM level_members
        WHERE guild_id = ? AND xp > 0
      `),
      rankForMember: this.database.prepare(`
        SELECT 1 + COUNT(*) AS rank
        FROM level_members
        WHERE guild_id = ?
          AND xp > 0
          AND (xp > ? OR (xp = ? AND user_id < ?))
      `),
      listRewards: this.database.prepare(`
        SELECT role_id, required_level
        FROM level_role_rewards
        WHERE guild_id = ?
        ORDER BY required_level ASC, role_id ASC
      `),
      upsertReward: this.database.prepare(`
        INSERT INTO level_role_rewards (guild_id, role_id, required_level, created_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(guild_id, role_id) DO UPDATE SET
          required_level = excluded.required_level
      `),
      removeReward: this.database.prepare(`
        DELETE FROM level_role_rewards
        WHERE guild_id = ? AND role_id = ?
      `),
      getAutoRole: this.database.prepare(`
        SELECT enabled, role_id
        FROM auto_role_config
        WHERE guild_id = ?
      `),
      setAutoRole: this.database.prepare(`
        INSERT INTO auto_role_config (guild_id, role_id, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(guild_id) DO UPDATE SET
          enabled = 0,
          role_id = excluded.role_id,
          updated_at = excluded.updated_at
      `),
      setAutoRoleEnabled: this.database.prepare(`
        INSERT INTO auto_role_config (guild_id, enabled, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(guild_id) DO UPDATE SET
          enabled = excluded.enabled,
          updated_at = excluded.updated_at
      `),
      clearAutoRole: this.database.prepare(`
        INSERT INTO auto_role_config (guild_id, enabled, role_id, updated_at)
        VALUES (?, 0, NULL, ?)
        ON CONFLICT(guild_id) DO UPDATE SET
          enabled = 0,
          role_id = NULL,
          updated_at = excluded.updated_at
      `),
      incrementWarningTotal: this.database.prepare(`
        INSERT INTO moderation_warning_totals (
          guild_id,
          user_id,
          total,
          updated_at
        ) VALUES (?, ?, 1, ?)
        ON CONFLICT(guild_id, user_id) DO UPDATE SET
          total = total + 1,
          updated_at = excluded.updated_at
        RETURNING total
      `),
      insertWarning: this.database.prepare(`
        INSERT INTO moderation_warnings (
          guild_id,
          user_id,
          moderator_id,
          reason,
          created_at
        ) VALUES (?, ?, ?, ?, ?)
      `),
      pruneWarningHistory: this.database.prepare(`
        DELETE FROM moderation_warnings
        WHERE guild_id = ? AND user_id = ? AND id NOT IN (
          SELECT id
          FROM moderation_warnings
          WHERE guild_id = ? AND user_id = ?
          ORDER BY created_at DESC, id DESC
          LIMIT ${MAX_WARNING_HISTORY_PER_MEMBER}
        )
      `),
      getWarningTotal: this.database.prepare(`
        SELECT total
        FROM moderation_warning_totals
        WHERE guild_id = ? AND user_id = ?
      `),
      getRecentWarnings: this.database.prepare(`
        SELECT id, moderator_id, reason, created_at
        FROM moderation_warnings
        WHERE guild_id = ? AND user_id = ?
        ORDER BY created_at DESC, id DESC
        LIMIT ?
      `),
      getLockdown: this.database.prepare(`
        SELECT
          previous_send_messages,
          previous_send_messages_in_threads,
          locked_by,
          locked_at
        FROM channel_lockdowns
        WHERE guild_id = ? AND channel_id = ?
      `),
      saveLockdown: this.database.prepare(`
        INSERT INTO channel_lockdowns (
          guild_id,
          channel_id,
          previous_send_messages,
          previous_send_messages_in_threads,
          locked_by,
          locked_at
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(guild_id, channel_id) DO NOTHING
      `),
      removeLockdown: this.database.prepare(`
        DELETE FROM channel_lockdowns
        WHERE guild_id = ? AND channel_id = ?
      `),
      getModLogConfig: this.database.prepare(`
        SELECT enabled, channel_id
        FROM moderation_log_config
        WHERE guild_id = ?
      `),
      setModLogChannel: this.database.prepare(`
        INSERT INTO moderation_log_config (guild_id, channel_id, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(guild_id) DO UPDATE SET
          channel_id = excluded.channel_id,
          updated_at = excluded.updated_at
      `),
      setModLogEnabled: this.database.prepare(`
        INSERT INTO moderation_log_config (guild_id, enabled, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(guild_id) DO UPDATE SET
          enabled = excluded.enabled,
          updated_at = excluded.updated_at
      `),
      clearModLogChannel: this.database.prepare(`
        INSERT INTO moderation_log_config (guild_id, enabled, channel_id, updated_at)
        VALUES (?, 0, NULL, ?)
        ON CONFLICT(guild_id) DO UPDATE SET
          enabled = 0,
          channel_id = NULL,
          updated_at = excluded.updated_at
      `),
    });
  }

  assertReady() {
    if (!this.database || !this.statements) {
      throw new Error("The level database is unavailable.");
    }
  }

  getHealth() {
    return this.health;
  }

  getConfig(guildId) {
    validateSnowflake(guildId, "Guild ID");
    this.assertReady();
    return mapConfig(this.statements.getConfig.get(guildId), guildId);
  }

  setEnabled(guildId, enabled) {
    validateSnowflake(guildId, "Guild ID");
    if (typeof enabled !== "boolean") {
      throw new Error("Enabled state must be true or false.");
    }
    this.assertReady();
    this.statements.setEnabled.run(guildId, enabled ? 1 : 0, Date.now());
    return this.getConfig(guildId);
  }

  setNotificationChannel(guildId, channelId) {
    validateSnowflake(guildId, "Guild ID");
    if (channelId !== null) {
      validateSnowflake(channelId, "Channel ID");
    }
    this.assertReady();
    this.statements.setChannel.run(guildId, channelId, Date.now());
    return this.getConfig(guildId);
  }

  setSettings(guildId, { xpMin, xpMax, cooldownSeconds }) {
    validateSnowflake(guildId, "Guild ID");
    validateInteger(xpMin, 1, 100, "Minimum XP");
    validateInteger(xpMax, 1, 100, "Maximum XP");
    validateInteger(cooldownSeconds, 15, 3_600, "Cooldown");
    if (xpMin > xpMax) {
      throw new Error("Minimum XP cannot be greater than maximum XP.");
    }
    this.assertReady();
    this.statements.setSettings.run(
      guildId,
      xpMin,
      xpMax,
      cooldownSeconds,
      Date.now(),
    );
    return this.getConfig(guildId);
  }

  awardMessageXp({ guildId, userId, messageId, now, xp }) {
    validateSnowflake(guildId, "Guild ID");
    validateSnowflake(userId, "User ID");
    validateSnowflake(messageId, "Message ID");
    validateInteger(now, 0, Number.MAX_SAFE_INTEGER, "Award timestamp");
    validateInteger(xp, 1, 100, "XP award");
    this.assertReady();

    const config = this.getConfig(guildId);
    if (!config.enabled) {
      return Object.freeze({ awarded: false, reason: "disabled", config });
    }

    this.database.exec("BEGIN IMMEDIATE");

    try {
      const existing = this.statements.getMember.get(guildId, userId);
      if (existing?.last_message_id === messageId) {
        this.database.exec("ROLLBACK");
        return Object.freeze({ awarded: false, reason: "duplicate", config });
      }

      const lastAwardedAt = existing?.last_awarded_at ?? 0;
      const nextEligibleAt = lastAwardedAt + config.cooldownSeconds * 1_000;
      if (lastAwardedAt > 0 && now < nextEligibleAt) {
        this.database.exec("ROLLBACK");
        return Object.freeze({
          awarded: false,
          reason: "cooldown",
          nextEligibleAt,
          config,
        });
      }

      const previousXp = existing?.xp ?? 0;
      const newXp = Math.min(MAX_TOTAL_XP, previousXp + xp);
      const awardedXp = newXp - previousXp;
      const awardedMessages = (existing?.awarded_messages ?? 0) + 1;

      this.statements.saveMember.run(
        guildId,
        userId,
        newXp,
        awardedMessages,
        now,
        messageId,
      );
      this.database.exec("COMMIT");

      return Object.freeze({
        awarded: true,
        reason: "awarded",
        previousXp,
        newXp,
        awardedXp,
        awardedMessages,
        config,
      });
    } catch (error) {
      if (this.database.isTransaction) {
        this.database.exec("ROLLBACK");
      }
      throw error;
    }
  }

  getMemberStats(guildId, userId) {
    validateSnowflake(guildId, "Guild ID");
    validateSnowflake(userId, "User ID");
    this.assertReady();

    const member = this.statements.getMember.get(guildId, userId);
    if (!member || member.xp <= 0) {
      return Object.freeze({
        userId,
        xp: 0,
        awardedMessages: 0,
        rank: null,
      });
    }

    const rank = this.statements.rankForMember.get(
      guildId,
      member.xp,
      member.xp,
      userId,
    ).rank;

    return Object.freeze({
      userId,
      xp: member.xp,
      awardedMessages: member.awarded_messages,
      rank,
    });
  }

  getLeaderboard(guildId, { limit = 10, offset = 0 } = {}) {
    validateSnowflake(guildId, "Guild ID");
    validateInteger(limit, 1, 100, "Leaderboard limit");
    validateInteger(offset, 0, 100_000, "Leaderboard offset");
    this.assertReady();

    const rows = this.statements.leaderboard.all(guildId, limit, offset);
    const total = this.statements.rankedMemberCount.get(guildId).count;

    return Object.freeze({
      total,
      rows: Object.freeze(
        rows.map((row, index) =>
          Object.freeze({
            rank: offset + index + 1,
            userId: row.user_id,
            xp: row.xp,
            awardedMessages: row.awarded_messages,
          }),
        ),
      ),
    });
  }

  setRoleReward(guildId, roleId, requiredLevel) {
    validateSnowflake(guildId, "Guild ID");
    validateSnowflake(roleId, "Role ID");
    validateInteger(requiredLevel, 1, 1_000, "Required level");
    this.assertReady();
    this.statements.upsertReward.run(guildId, roleId, requiredLevel, Date.now());
    return this.listRoleRewards(guildId);
  }

  removeRoleReward(guildId, roleId) {
    validateSnowflake(guildId, "Guild ID");
    validateSnowflake(roleId, "Role ID");
    this.assertReady();
    return this.statements.removeReward.run(guildId, roleId).changes > 0;
  }

  listRoleRewards(guildId) {
    validateSnowflake(guildId, "Guild ID");
    this.assertReady();
    return Object.freeze(
      this.statements.listRewards.all(guildId).map((row) =>
        Object.freeze({
          roleId: row.role_id,
          requiredLevel: row.required_level,
        }),
      ),
    );
  }

  getAutoRoleConfig(guildId) {
    validateSnowflake(guildId, "Guild ID");
    this.assertReady();
    return mapAutoRoleConfig(this.statements.getAutoRole.get(guildId), guildId);
  }

  setAutoRole(guildId, roleId) {
    validateSnowflake(guildId, "Guild ID");
    validateSnowflake(roleId, "Role ID");
    this.assertReady();
    this.statements.setAutoRole.run(guildId, roleId, Date.now());
    return this.getAutoRoleConfig(guildId);
  }

  setAutoRoleEnabled(guildId, enabled) {
    validateSnowflake(guildId, "Guild ID");
    if (typeof enabled !== "boolean") {
      throw new Error("Auto-role enabled state must be true or false.");
    }
    this.assertReady();
    this.statements.setAutoRoleEnabled.run(guildId, enabled ? 1 : 0, Date.now());
    return this.getAutoRoleConfig(guildId);
  }

  clearAutoRole(guildId) {
    validateSnowflake(guildId, "Guild ID");
    this.assertReady();
    this.statements.clearAutoRole.run(guildId, Date.now());
    return this.getAutoRoleConfig(guildId);
  }

  addWarning({ guildId, userId, moderatorId, reason, createdAt = Date.now() }) {
    validateSnowflake(guildId, "Guild ID");
    validateSnowflake(userId, "User ID");
    validateSnowflake(moderatorId, "Moderator ID");
    validateInteger(createdAt, 0, Number.MAX_SAFE_INTEGER, "Warning timestamp");
    if (typeof reason !== "string" || reason.trim().length < 1 || reason.length > 500) {
      throw new Error("Warning reason must contain 1–500 characters.");
    }
    this.assertReady();

    this.database.exec("BEGIN IMMEDIATE");
    try {
      const normalizedReason = reason.trim();
      this.statements.insertWarning.run(
        guildId,
        userId,
        moderatorId,
        normalizedReason,
        createdAt,
      );
      const total = this.statements.incrementWarningTotal.get(
        guildId,
        userId,
        createdAt,
      ).total;
      this.statements.pruneWarningHistory.run(
        guildId,
        userId,
        guildId,
        userId,
      );
      this.database.exec("COMMIT");
      return Object.freeze({ total, reason: normalizedReason, createdAt });
    } catch (error) {
      if (this.database.isTransaction) {
        this.database.exec("ROLLBACK");
      }
      throw error;
    }
  }

  getWarnings(guildId, userId, limit = 10) {
    validateSnowflake(guildId, "Guild ID");
    validateSnowflake(userId, "User ID");
    validateInteger(limit, 1, 25, "Warning history limit");
    this.assertReady();

    const total = this.statements.getWarningTotal.get(guildId, userId)?.total ?? 0;
    const history = this.statements.getRecentWarnings
      .all(guildId, userId, limit)
      .map((row) =>
        Object.freeze({
          id: row.id,
          moderatorId: row.moderator_id,
          reason: row.reason,
          createdAt: row.created_at,
        }),
      );
    return Object.freeze({ total, history: Object.freeze(history) });
  }

  getLockdown(guildId, channelId) {
    validateSnowflake(guildId, "Guild ID");
    validateSnowflake(channelId, "Channel ID");
    this.assertReady();
    const row = this.statements.getLockdown.get(guildId, channelId);
    if (!row) {
      return null;
    }
    return Object.freeze({
      previousSendMessages:
        row.previous_send_messages === null
          ? null
          : row.previous_send_messages === 1,
      previousSendMessagesInThreads:
        row.previous_send_messages_in_threads === null
          ? null
          : row.previous_send_messages_in_threads === 1,
      lockedBy: row.locked_by,
      lockedAt: row.locked_at,
    });
  }

  saveLockdown({
    guildId,
    channelId,
    previousSendMessages,
    previousSendMessagesInThreads,
    lockedBy,
    lockedAt = Date.now(),
  }) {
    validateSnowflake(guildId, "Guild ID");
    validateSnowflake(channelId, "Channel ID");
    validateSnowflake(lockedBy, "Moderator ID");
    validateInteger(lockedAt, 0, Number.MAX_SAFE_INTEGER, "Lockdown timestamp");
    if (![true, false, null].includes(previousSendMessages)) {
      throw new Error("Previous Send Messages state must be true, false, or null.");
    }
    if (![true, false, null].includes(previousSendMessagesInThreads)) {
      throw new Error(
        "Previous Send Messages in Threads state must be true, false, or null.",
      );
    }
    this.assertReady();
    const value = previousSendMessages === null ? null : previousSendMessages ? 1 : 0;
    const threadValue =
      previousSendMessagesInThreads === null
        ? null
        : previousSendMessagesInThreads
          ? 1
          : 0;
    const result = this.statements.saveLockdown.run(
      guildId,
      channelId,
      value,
      threadValue,
      lockedBy,
      lockedAt,
    );
    return result.changes > 0;
  }

  removeLockdown(guildId, channelId) {
    validateSnowflake(guildId, "Guild ID");
    validateSnowflake(channelId, "Channel ID");
    this.assertReady();
    return this.statements.removeLockdown.run(guildId, channelId).changes > 0;
  }

  getModLogConfig(guildId) {
    validateSnowflake(guildId, "Guild ID");
    this.assertReady();
    return mapModLogConfig(this.statements.getModLogConfig.get(guildId), guildId);
  }

  setModLogChannel(guildId, channelId) {
    validateSnowflake(guildId, "Guild ID");
    validateSnowflake(channelId, "Channel ID");
    this.assertReady();
    this.statements.setModLogChannel.run(guildId, channelId, Date.now());
    return this.getModLogConfig(guildId);
  }

  setModLogEnabled(guildId, enabled) {
    validateSnowflake(guildId, "Guild ID");
    if (typeof enabled !== "boolean") {
      throw new Error("Moderation-log enabled state must be true or false.");
    }
    this.assertReady();
    this.statements.setModLogEnabled.run(guildId, enabled ? 1 : 0, Date.now());
    return this.getModLogConfig(guildId);
  }

  clearModLogChannel(guildId) {
    validateSnowflake(guildId, "Guild ID");
    this.assertReady();
    this.statements.clearModLogChannel.run(guildId, Date.now());
    return this.getModLogConfig(guildId);
  }

  close() {
    if (!this.database) {
      return;
    }

    this.database.close();
    this.database = null;
    this.statements = null;
    this.health = Object.freeze({ ok: false, message: "Level database is closed." });
  }
}
