const SECTION_NAMES = Object.freeze([
  "welcome",
  "levels",
  "automod",
  "autorole",
  "booster",
  "modlog",
  "tickets",
]);

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
  constructor({ url, token, pollMs = 4_000, levelStore, welcomeStore, logger }) {
    this.url = String(url ?? "").trim().replace(/\/$/, "");
    this.token = String(token ?? "").trim();
    this.pollMs = Math.min(60_000, Math.max(2_000, safeInteger(pollMs, 4_000)));
    this.levelStore = levelStore;
    this.welcomeStore = welcomeStore;
    this.logger = logger;
    this.enabled = Boolean(this.url && this.token);
    this.client = null;
    this.timer = null;
    this.syncing = new Set();
    this.dirty = new Set();
    this.remoteCache = new Map();
    this.stopped = false;
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

    await Promise.allSettled(
      [...client.guilds.cache.keys()].map((guildId) => this.syncGuild(guildId)),
    );

    if (this.stopped) return;
    this.timer = setInterval(() => {
      void this.syncAllGuilds();
    }, this.pollMs);
    this.timer.unref?.();

    this.logger.info("SHARED_CONFIG_READY", "Sofra Panel shared configuration synchronization is active.", {
      guildCount: client.guilds.cache.size,
      pollMs: this.pollMs,
    });
  }

  stop() {
    this.stopped = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async syncAllGuilds() {
    if (!this.enabled || !this.client || this.stopped) return;
    await Promise.allSettled(
      [...this.client.guilds.cache.keys()].map((guildId) => this.syncGuild(guildId)),
    );
  }

  async syncGuild(guildId) {
    if (!this.enabled || this.stopped || this.syncing.has(guildId)) return;
    this.syncing.add(guildId);

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
    } catch (error) {
      this.logger.warn(
        "SHARED_CONFIG_SYNC_FAILED",
        "Sofra could not refresh dashboard settings; the last known local configuration remains active.",
        { guildId, message: error.message },
      );
    } finally {
      this.syncing.delete(guildId);
    }
  }

  async markDirty(guildId, section) {
    if (!this.enabled) return;
    const key = sectionKey(guildId, section);
    this.dirty.add(key);
    try {
      await this.pushSection(guildId, section);
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
    await this.writeRemoteSection(guildId, section, local);
    this.remoteCache.set(sectionKey(guildId, section), freezeCopy(local));
  }

  async pushSection(guildId, section) {
    const key = sectionKey(guildId, section);
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
    this.dirty.delete(key);
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
