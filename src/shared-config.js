import { createHash } from "node:crypto";

const SECTION_NAMES = Object.freeze([
  "welcome",
  "levels",
  "automod",
  "autorole",
  "booster",
  "modlog",
  "tickets",
]);

const DIRTY_GUILDS_KEY = "sofra:config:dirty";
const HEARTBEAT_KEY = "sofra:runtime:heartbeat";
const HEARTBEAT_TTL_SECONDS = 180;
const FULL_SYNC_MS = 6 * 60 * 60 * 1000;

const LEVEL_MUTATIONS = Object.freeze({
  setEnabled: "levels",
  setNotificationChannel: "levels",
  setSettings: "levels",
  setRoleReward: "levels",
  removeRoleReward: "levels",
  setAutomodConfig: "automod",
  setAutomodRole: "automod",
  setAutomodChannel: "automod",
  setAutomodWord: "automod",
  setAutomodCategory: "automod",
  applyAutomodCategories: "automod",
  setAutomodRule: "automod",
  setAutoRole: "autorole",
  setAutoRoleEnabled: "autorole",
  clearAutoRole: "autorole",
  setBoosterConfig: "booster",
  setBoosterEnabled: "booster",
  clearBoosterRole: "booster",
  clearBoosterChannel: "booster",
  setModLogChannel: "modlog",
  setModLogEnabled: "modlog",
  clearModLogChannel: "modlog",
  setTicketConfig: "tickets",
});

const WELCOME_MUTATIONS = Object.freeze({
  setChannel: "welcome",
  setEnabled: "welcome",
  setCustomization: "welcome",
});

function parseHgetall(result) {
  if (!result) return {};
  if (!Array.isArray(result)) return result;
  const object = {};
  for (let index = 0; index < result.length; index += 2) {
    object[result[index]] = result[index + 1];
  }
  return object;
}

function freezeCopy(value) {
  if (Array.isArray(value)) {
    return Object.freeze(value.map((item) => freezeCopy(item)));
  }
  if (value && typeof value === "object") {
    return Object.freeze(
      Object.fromEntries(Object.entries(value).map(([key, item]) => [key, freezeCopy(item)])),
    );
  }
  return value;
}

function sectionKey(guildId, section) {
  return `${guildId}:${section}`;
}

function safeInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) ? number : fallback;
}

export class SharedConfigSync {
  constructor({ url, token, pollMs = 60_000, levelStore, welcomeStore, logger }) {
    this.url = String(url ?? "").trim().replace(/\/$/, "");
    this.token = String(token ?? "").trim();
    this.pollMs = Math.min(300_000, Math.max(10_000, safeInteger(pollMs, 60_000)));
    this.levelStore = levelStore;
    this.welcomeStore = welcomeStore;
    this.logger = logger;
    this.enabled = Boolean(this.url && this.token);
    this.client = null;
    this.timer = null;
    this.fullSyncTimer = null;
    this.syncing = new Set();
    this.dirty = new Set();
    this.remoteCache = new Map();
    this.stopped = false;
    this.queues = new Map();
    this.versions = new Map();
    this.polling = false;
    this.changedPolling = false;
  }

  wrapLevelStore() {
    return this.createStoreProxy(this.levelStore, LEVEL_MUTATIONS, {
      getTicketConfig: (guildId) => this.getMergedTicketConfig(guildId),
    });
  }

  wrapWelcomeStore() {
    return this.createStoreProxy(this.welcomeStore, WELCOME_MUTATIONS);
  }

  createStoreProxy(target, mutationMap, overrides = {}) {
    return new Proxy(target, {
      get: (_proxyTarget, property) => {
        if (Object.prototype.hasOwnProperty.call(overrides, property)) {
          return overrides[property];
        }

        const value = target[property];
        if (typeof value !== "function") {
          return value;
        }

        const section = mutationMap[property];
        if (!section) {
          return value.bind(target);
        }

        return (...args) => {
          const result = value.apply(target, args);
          const guildId = this.guildIdFromMutation(property, args);
          if (guildId) {
            Promise.resolve(result)
              .then(() => this.markDirty(guildId, section))
              .catch(() => undefined);
          }
          return result;
        };
      },
    });
  }

  guildIdFromMutation(method, args) {
    if (method === "setTicketConfig") {
      return args[0]?.guildId ?? null;
    }
    return typeof args[0] === "string" ? args[0] : null;
  }

  getMergedTicketConfig(guildId) {
    const local = this.levelStore.getTicketConfig(guildId);
    const remote = this.remoteCache.get(sectionKey(guildId, "tickets"));
    if (!remote) {
      return local;
    }
    return freezeCopy({
      ...remote,
      ...local,
      enabled: remote.enabled !== false,
      types: {
        bug: remote.types?.bug !== false,
        report: remote.types?.report !== false,
        other: remote.types?.other !== false,
      },
    });
  }

  async start(client) {
    this.client = client;
    this.stopped = false;

    if (!this.enabled) {
      this.logger.warn(
        "SHARED_CONFIG_DISABLED",
        "Sofra Panel shared configuration is disabled because the Upstash REST variables are not configured. Local Discord configuration will continue to work.",
      );
      return;
    }

    this.logger.info("SHARED_CONFIG_STARTING", "Connecting Sofra to the shared dashboard configuration store.", {
      pollMs: this.pollMs,
    });

    // One full reconciliation at startup preserves migration/seeding behavior.
    // Normal operation then consumes only guilds explicitly marked dirty by
    // dashboard saves. A slow full reconciliation is kept as a safety net.
    await this.syncAllGuilds();
    await this.writeHeartbeat().catch(() => undefined);

    if (this.stopped) return;
    this.timer = setInterval(() => {
      void this.syncChangedGuilds();
    }, this.pollMs);
    this.timer.unref?.();

    this.fullSyncTimer = setInterval(() => {
      void this.syncAllGuilds();
    }, FULL_SYNC_MS);
    this.fullSyncTimer.unref?.();

    this.logger.info("SHARED_CONFIG_READY", "Sofra Panel shared configuration synchronization is active.", {
      guildCount: client.guilds.cache.size,
      pollMs: this.pollMs,
      fullSyncMs: FULL_SYNC_MS,
    });
  }

  stop() {
    this.stopped = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.fullSyncTimer) {
      clearInterval(this.fullSyncTimer);
      this.fullSyncTimer = null;
    }
  }

  async writeHeartbeat() {
    if (!this.enabled || this.stopped) return;
    await this.command([
      "SET",
      HEARTBEAT_KEY,
      String(Date.now()),
      "EX",
      String(HEARTBEAT_TTL_SECONDS),
    ]);
  }

  async syncChangedGuilds() {
    if (!this.enabled || !this.client || this.stopped || this.changedPolling) return;
    this.changedPolling = true;
    try {
      await this.writeHeartbeat();
      const changed = await this.command(["SMEMBERS", DIRTY_GUILDS_KEY]);
      const guildIds = Array.isArray(changed) ? [...new Set(changed.map(String))] : [];
      if (!guildIds.length) return;

      const pending = [];
      const stale = [];
      for (const guildId of guildIds) {
        if (this.client.guilds.cache.has(guildId)) pending.push(guildId);
        else stale.push(guildId);
      }

      if (stale.length) {
        await this.command(["SREM", DIRTY_GUILDS_KEY, ...stale]);
      }

      await Promise.all(Array.from({ length: Math.min(4, pending.length) }, async () => {
        while (pending.length && !this.stopped) {
          const guildId = pending.shift();
          const synced = await this.syncGuild(guildId);
          if (synced) await this.command(["SREM", DIRTY_GUILDS_KEY, guildId]);
        }
      }));
    } catch (error) {
      this.logger.warn(
        "SHARED_CONFIG_DIRTY_POLL_FAILED",
        "Sofra could not check dashboard configuration changes; local settings remain active and the next poll will retry.",
        { message: error.message },
      );
    } finally {
      this.changedPolling = false;
    }
  }

  async syncAllGuilds() {
    if (!this.enabled || !this.client || this.stopped || this.polling) return;
    this.polling = true;
    const guilds = [...this.client.guilds.cache.keys()];
    try {
      // Bound outbound concurrency instead of launching one request per guild.
      await Promise.all(Array.from({ length: Math.min(4, guilds.length) }, async () => {
        while (guilds.length && !this.stopped) await this.syncGuild(guilds.shift());
      }));
    } finally { this.polling = false; }
  }

  async syncGuild(guildId) {
    if (!this.enabled || this.stopped || this.syncing.has(guildId)) return false;
    this.syncing.add(guildId);
    try { return await this.enqueue(guildId, () => this.refreshGuild(guildId)); }
    finally { this.syncing.delete(guildId); }
  }

  enqueue(guildId, task) {
    const previous = this.queues.get(guildId) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(task);
    this.queues.set(guildId, next);
    void next.finally(() => {
      if (this.queues.get(guildId) === next) this.queues.delete(guildId);
    }).catch(() => undefined);
    return next;
  }

  async refreshGuild(guildId) {
    try {
      const remoteDocument = await this.readRemoteDocument(guildId);

      for (const section of SECTION_NAMES) {
        const key = sectionKey(guildId, section);
        const remoteRaw = remoteDocument[section];

        if (this.dirty.has(key)) {
          await this.pushSection(guildId, section);
          continue;
        }

        if (!remoteRaw) {
          await this.seedSection(guildId, section);
          continue;
        }

        let remote;
        try {
          remote = JSON.parse(remoteRaw);
        } catch (error) {
          this.logger.warn(
            "SHARED_CONFIG_MALFORMED_SECTION",
            "A malformed Sofra Panel configuration section was ignored.",
            { guildId, section, message: error.message },
          );
          continue;
        }

        const previous = this.remoteCache.get(key);
        if (previous && JSON.stringify(previous) === JSON.stringify(remote)) {
          continue;
        }

        await this.applyRemoteSection(guildId, section, remote);
        this.remoteCache.set(key, freezeCopy(remote));
      }
      const applied = Object.fromEntries(SECTION_NAMES.map((section) => {
        const value = this.remoteCache.get(sectionKey(guildId, section));
        return [section, value ? createHash("sha256").update(JSON.stringify(value)).digest("hex") : null];
      }));
      if (!this.client?.isReady || this.client.isReady()) {
        // Applied hashes are durable enough to compare later. Bot liveness is
        // reported separately through one global heartbeat instead of one SET
        // per guild every few seconds.
        await this.command([
          "SET",
          `sofra:guild:${guildId}:runtime`,
          JSON.stringify({ lastSyncedAt: Date.now(), applied }),
          "EX",
          "86400",
        ]);
      }
      return true;
    } catch (error) {
      this.logger.warn(
        "SHARED_CONFIG_SYNC_FAILED",
        "Sofra could not refresh dashboard settings; the last known local configuration remains active.",
        { guildId, message: error.message },
      );
      return false;
    }
  }

  async markDirty(guildId, section) {
    if (!this.enabled) return;
    const key = sectionKey(guildId, section);
    this.dirty.add(key);
    this.versions.set(key, (this.versions.get(key) ?? 0) + 1);
    try {
      await this.enqueue(guildId, () => this.pushSection(guildId, section));
    } catch (error) {
      this.logger.warn(
        "SHARED_CONFIG_PUSH_FAILED",
        "A Discord-side configuration change was saved locally but could not yet be mirrored to Sofra Panel. It will be retried automatically.",
        { guildId, section, message: error.message },
      );
    }
  }

  async seedSection(guildId, section) {
    const local = this.snapshotSection(guildId, section);
    // A dashboard save between HGETALL and seeding must not be overwritten.
    const inserted = await this.command(["HSETNX", `sofra:guild:${guildId}:config`, section, JSON.stringify(local)]);
    if (inserted) this.remoteCache.set(sectionKey(guildId, section), freezeCopy(local));
  }

  async pushSection(guildId, section) {
    const key = sectionKey(guildId, section);
    const version = this.versions.get(key);
    const local = this.snapshotSection(guildId, section);
    const remote = this.remoteCache.get(key);
    const merged = section === "tickets"
      ? {
          ...(remote ?? {}),
          ...local,
          enabled: remote?.enabled !== false,
          types: {
            bug: remote?.types?.bug !== false,
            report: remote?.types?.report !== false,
            other: remote?.types?.other !== false,
          },
        }
      : local;

    await this.writeRemoteSection(guildId, section, merged);
    this.remoteCache.set(key, freezeCopy(merged));
    if (this.versions.get(key) === version) this.dirty.delete(key);
  }

  snapshotSection(guildId, section) {
    if (section === "welcome") {
      return this.welcomeStore.getGuildConfig(guildId);
    }
    if (section === "levels") {
      return {
        ...this.levelStore.getConfig(guildId),
        roleRewards: this.levelStore.listRoleRewards(guildId),
        boosterMultiplier: 1.5,
      };
    }
    if (section === "automod") {
      return this.levelStore.getAutomodConfig(guildId);
    }
    if (section === "autorole") {
      return this.levelStore.getAutoRoleConfig(guildId);
    }
    if (section === "booster") {
      return this.levelStore.getBoosterConfig(guildId);
    }
    if (section === "modlog") {
      return this.levelStore.getModLogConfig(guildId);
    }
    if (section === "tickets") {
      return this.levelStore.getTicketConfig(guildId);
    }
    throw new Error(`Unsupported shared configuration section: ${section}`);
  }

  async applyRemoteSection(guildId, section, remote) {
    if (!remote || typeof remote !== "object" || Array.isArray(remote)) {
      throw new Error(`Remote ${section} configuration is not an object.`);
    }

    if (section === "welcome") {
      await this.applyWelcome(guildId, remote);
      return;
    }
    if (section === "levels") {
      this.applyLevels(guildId, remote);
      return;
    }
    if (section === "automod") {
      this.applyAutomod(guildId, remote);
      return;
    }
    if (section === "autorole") {
      this.applyAutoRole(guildId, remote);
      return;
    }
    if (section === "booster") {
      this.applyBooster(guildId, remote);
      return;
    }
    if (section === "modlog") {
      this.applyModLog(guildId, remote);
      return;
    }
    if (section === "tickets") {
      this.applyTickets(guildId, remote);
    }
  }

  async applyWelcome(guildId, remote) {
    await this.welcomeStore.setChannel(guildId, remote.channelId ?? null);
    await this.welcomeStore.setCustomization(guildId, {
      randomMessages: remote.randomMessages !== false,
      messageTemplate: remote.messageTemplate ?? null,
      embedTitle: remote.embedTitle ?? null,
      embedDescription: remote.embedDescription ?? null,
      color: remote.color ?? null,
      imageUrl: remote.imageUrl ?? null,
      thumbnailMode: remote.thumbnailMode ?? "member",
    });
    await this.welcomeStore.setEnabled(guildId, remote.enabled === true);
  }

  applyLevels(guildId, remote) {
    const current = this.levelStore.getConfig(guildId);
    this.levelStore.setSettings(guildId, {
      xpMin: safeInteger(remote.xpMin, current.xpMin),
      xpMax: safeInteger(remote.xpMax, current.xpMax),
      cooldownSeconds: safeInteger(remote.cooldownSeconds, current.cooldownSeconds),
    });
    this.levelStore.setNotificationChannel(guildId, remote.notificationChannelId ?? null);
    this.levelStore.setEnabled(guildId, remote.enabled === true);

    const desiredRewards = new Map(
      (Array.isArray(remote.roleRewards) ? remote.roleRewards : [])
        .filter((reward) => reward?.roleId)
        .map((reward) => [reward.roleId, safeInteger(reward.requiredLevel, 1)]),
    );
    for (const reward of this.levelStore.listRoleRewards(guildId)) {
      if (!desiredRewards.has(reward.roleId)) {
        this.levelStore.removeRoleReward(guildId, reward.roleId);
      }
    }
    for (const [roleId, requiredLevel] of desiredRewards) {
      this.levelStore.setRoleReward(guildId, roleId, requiredLevel);
    }
  }

  applyAutomod(guildId, remote) {
    this.levelStore.setAutomodConfig(guildId, {
      enabled: remote.enabled === true,
      dryRun: remote.dryRun === true,
      spamEnabled: remote.spamEnabled === true,
      messageLimit: safeInteger(remote.messageLimit, 7),
      mentionLimit: safeInteger(remote.mentionLimit, 6),
      mildAction: remote.mildAction ?? "allow",
      linksEnabled: remote.linksEnabled === true,
      invitesEnabled: remote.invitesEnabled !== false,
      warningCooldownSeconds: safeInteger(remote.warningCooldownSeconds, 30),
      escalationThreshold: safeInteger(remote.escalationThreshold, 4),
      timeoutMinutes: safeInteger(remote.timeoutMinutes, 10),
      strikesEnabled: remote.strikesEnabled !== false,
    });

    const current = this.levelStore.getAutomodConfig(guildId);
    const desiredRoles = new Set(
      (Array.isArray(remote.roles) ? remote.roles : [])
        .filter((item) => item?.roleId && item?.kind)
        .map((item) => `${item.roleId}:${item.kind}`),
    );
    for (const item of current.roles) {
      const key = `${item.roleId}:${item.kind}`;
      if (!desiredRoles.has(key)) {
        this.levelStore.setAutomodRole(guildId, item.roleId, item.kind, false);
      }
    }
    for (const key of desiredRoles) {
      const [roleId, kind] = key.split(":");
      this.levelStore.setAutomodRole(guildId, roleId, kind, true);
    }

    const desiredChannels = new Map(
      (Array.isArray(remote.channels) ? remote.channels : [])
        .filter((item) => item?.channelId && item?.mode)
        .map((item) => [item.channelId, item.mode]),
    );
    for (const item of current.channels) {
      if (!desiredChannels.has(item.channelId)) {
        this.levelStore.setAutomodChannel(guildId, item.channelId, null);
      }
    }
    for (const [channelId, mode] of desiredChannels) {
      this.levelStore.setAutomodChannel(guildId, channelId, mode);
    }

    if (remote.categories && typeof remote.categories === "object") {
      this.levelStore.applyAutomodCategories(guildId, remote.categories);
    }

    if (Array.isArray(remote.words)) {
      this.reconcileAutomodWords(guildId, current.words, remote.words);
    }
  }

  reconcileAutomodWords(guildId, currentWords, remoteWords) {
    const currentLegacy = new Map();
    const currentRules = new Map();
    for (const item of currentWords ?? []) {
      if (Number.isInteger(item?.tier)) currentLegacy.set(item.word, item);
      else if (item?.term || item?.word) currentRules.set(item.term ?? item.word, item);
    }

    const desiredLegacy = new Map();
    const desiredRules = new Map();
    for (const item of remoteWords) {
      if (Number.isInteger(item?.tier)) desiredLegacy.set(item.word, item);
      else if (item?.term || item?.word) desiredRules.set(item.term ?? item.word, item);
    }

    for (const word of currentLegacy.keys()) {
      if (!desiredLegacy.has(word)) this.levelStore.setAutomodWord(guildId, word, null);
    }
    for (const [word, item] of desiredLegacy) {
      this.levelStore.setAutomodWord(guildId, word, item.tier);
    }
    for (const term of currentRules.keys()) {
      if (!desiredRules.has(term)) this.levelStore.setAutomodRule(guildId, term, null);
    }
    for (const [term, item] of desiredRules) {
      this.levelStore.setAutomodRule(guildId, term, {
        category: item.category ?? "custom",
        severity: safeInteger(item.severity, 2),
        actionOverride: item.actionOverride ?? null,
        normalized: item.normalized !== false,
      });
    }
  }

  applyAutoRole(guildId, remote) {
    if (remote.roleId) this.levelStore.setAutoRole(guildId, remote.roleId);
    else this.levelStore.clearAutoRole(guildId);
    this.levelStore.setAutoRoleEnabled(guildId, remote.enabled === true && Boolean(remote.roleId));
  }

  applyBooster(guildId, remote) {
    if (remote.roleId && remote.channelId) {
      this.levelStore.setBoosterConfig(guildId, {
        roleId: remote.roleId,
        channelId: remote.channelId,
      });
    } else {
      if (!remote.roleId) this.levelStore.clearBoosterRole(guildId);
      if (!remote.channelId) this.levelStore.clearBoosterChannel(guildId);
    }
    this.levelStore.setBoosterEnabled(
      guildId,
      remote.enabled === true && Boolean(remote.roleId && remote.channelId),
    );
  }

  applyModLog(guildId, remote) {
    if (remote.channelId) this.levelStore.setModLogChannel(guildId, remote.channelId);
    else this.levelStore.clearModLogChannel(guildId);
    this.levelStore.setModLogEnabled(guildId, remote.enabled === true && Boolean(remote.channelId));
  }

  applyTickets(guildId, remote) {
    // Keep disabled states across restarts even when Redis is unavailable.
    this.levelStore.setTicketOptions(guildId, remote);
    if (
      remote.panelChannelId &&
      remote.panelMessageId &&
      remote.categoryId &&
      Array.isArray(remote.staffRoleIds) &&
      remote.staffRoleIds.length > 0
    ) {
      this.levelStore.setTicketConfig({
        guildId,
        panelChannelId: remote.panelChannelId,
        panelMessageId: remote.panelMessageId,
        categoryId: remote.categoryId,
        staffRoleIds: remote.staffRoleIds,
      });
    }
  }

  async readRemoteDocument(guildId) {
    const result = await this.command(["HGETALL", `sofra:guild:${guildId}:config`]);
    return parseHgetall(result);
  }

  async writeRemoteSection(guildId, section, value) {
    await this.command([
      "HSET",
      `sofra:guild:${guildId}:config`,
      section,
      JSON.stringify(value),
      "updatedAt",
      String(Date.now()),
    ]);
  }

  async command(args) {
    if (!this.enabled) throw new Error("Shared configuration is disabled.");
    const response = await fetch(this.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      throw new Error(`Upstash REST request failed with HTTP ${response.status}.`);
    }
    const payload = await response.json();
    if (payload.error) throw new Error(`Upstash Redis error: ${payload.error}`);
    return payload.result;
  }
}
