import { createHash } from "node:crypto";

export function fingerprint(message) {
  return createHash("sha256").update(JSON.stringify([message.content ?? "", message.embeds ?? []])).digest("hex");
}

// Only message fingerprints and timestamps live here, not message text.
export class TrafficGuard {
  constructor({ now = Date.now, limit = 10_000 } = {}) {
    this.now = now;
    this.limit = limit;
    this.members = new Map();
  }

  inspect(message, config) {
    if (!config.spamEnabled) return null;
    const mentions = (message.mentions?.users?.size ?? 0) + (message.mentions?.roles?.size ?? 0);
    if (mentions >= (config.mentionLimit ?? 6) || message.mentions?.everyone) return "mention-spam";
    const key = `${message.guild.id}:${message.author.id}`;
    const now = this.now();
    const history = (this.members.get(key) ?? []).filter((entry) => now - entry.time < 10_000);
    // Edits are re-scanned by the content filter but never counted as new traffic.
    if (history.some((entry) => entry.id === message.id)) return null;
    const hash = fingerprint(message);
    history.push({ id: message.id, hash, time: now });
    this.members.delete(key);
    this.members.set(key, history.slice(-20));
    while (this.members.size > this.limit) this.members.delete(this.members.keys().next().value);
    if (history.length >= (config.messageLimit ?? 7)) return "message-flood";
    if (message.content?.trim() && history.filter((entry) => entry.hash === hash).length >= 4) return "duplicate-spam";
    return null;
  }
}
