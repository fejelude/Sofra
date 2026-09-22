import { ActivityType } from "discord.js";

// Aggregate across ShardingManager workers when present. Never advertise a
// shard-local count as the global total if the aggregation fails.
export async function guildCount(client) {
  const counts = client.shard
    ? await client.shard.fetchClientValues("guilds.cache.size")
    : [client.guilds.cache.size];
  if (!counts.length || counts.some((count) => !Number.isSafeInteger(count) || count < 0)) {
    throw new Error("Guild count is not available from every shard.");
  }
  return counts.reduce((sum, count) => sum + count, 0);
}

export class PresenceService {
  constructor({ client, logger }) {
    this.client = client;
    this.logger = logger;
    this.timer = null;
    this.pending = null;
    this.updating = false;
  }

  start() {
    void this.refresh();
    this.timer = setInterval(() => void this.refresh(), 60_000);
    this.timer.unref?.();
  }

  schedule() {
    if (this.pending) return;
    this.pending = setTimeout(() => {
      this.pending = null;
      void this.refresh();
    }, 15_000);
    this.pending.unref?.();
  }

  async refresh() {
    if (this.updating || !this.client.isReady()) return;
    this.updating = true;
    try {
      const count = await guildCount(this.client);
      this.client.user.setPresence({
        status: "online",
        activities: [{ name: `${count.toLocaleString("en-US")} ${count === 1 ? "server" : "servers"}`, type: ActivityType.Watching }],
      });
    } catch (error) {
      this.logger.warn("PRESENCE_REFRESH_FAILED", "Keeping the last known presence.", { message: error.message });
    } finally {
      this.updating = false;
    }
  }

  stop() {
    clearInterval(this.timer);
    clearTimeout(this.pending);
  }
}
