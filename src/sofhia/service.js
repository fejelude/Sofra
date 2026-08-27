import { chooseSofhiaResponse } from "./messages.js";

export const SOFHIA_EASTER_EGG_MIN_COOLDOWN_SECONDS = 4;
export const SOFHIA_EASTER_EGG_MAX_COOLDOWN_SECONDS = 15;
export const SOFHIA_EASTER_EGG_DELETE_AFTER_MS = 10_000;
export const SOFHIA_TRIGGER_PATTERN =
  /(?<![\p{L}\p{N}_])(?:sofhia|sofi|fhia|pia)(?![\p{L}\p{N}_])/iu;

const MAX_COOLDOWN_ENTRIES = 5_000;

export function containsSofhiaTrigger(content) {
  return typeof content === "string" && SOFHIA_TRIGGER_PATTERN.test(content);
}

export function chooseSofhiaCooldownMs(random = Math.random) {
  const possibleSeconds =
    SOFHIA_EASTER_EGG_MAX_COOLDOWN_SECONDS -
    SOFHIA_EASTER_EGG_MIN_COOLDOWN_SECONDS +
    1;
  const offset = Math.floor(random() * possibleSeconds);
  const safeOffset = Math.max(0, Math.min(offset, possibleSeconds - 1));
  return (SOFHIA_EASTER_EGG_MIN_COOLDOWN_SECONDS + safeOffset) * 1_000;
}

export class SofhiaEasterEggService {
  constructor({
    logger,
    random = Math.random,
    now = Date.now,
    schedule = setTimeout,
  }) {
    this.logger = logger;
    this.random = random;
    this.now = now;
    this.schedule = schedule;
    this.cooldowns = new Map();
  }

  async handleMessage(message) {
    if (
      !message.inGuild() ||
      message.author.bot ||
      message.webhookId ||
      message.system ||
      !containsSofhiaTrigger(message.content)
    ) {
      return false;
    }

    const now = this.now();
    const cooldownKey = `${message.guildId}:${message.author.id}`;
    const cooldownUntil = this.cooldowns.get(cooldownKey);
    if (cooldownUntil !== undefined && now < cooldownUntil) {
      return true;
    }

    this.pruneCooldowns(now);
    this.cooldowns.delete(cooldownKey);
    const nextCooldownUntil = now + chooseSofhiaCooldownMs(this.random);
    this.cooldowns.set(cooldownKey, nextCooldownUntil);

    let reply;
    try {
      reply = await message.reply({
        content: chooseSofhiaResponse(this.random),
        allowedMentions: { parse: [], repliedUser: false },
      });
    } catch (error) {
      if (this.cooldowns.get(cooldownKey) === nextCooldownUntil) {
        this.cooldowns.delete(cooldownKey);
      }
      this.logger.error(
        "SOFHIA_EASTER_EGG_REPLY_FAILED",
        "The hidden Sofhia easter-egg reply could not be sent.",
        error,
        {
          guildId: message.guildId,
          channelId: message.channelId,
          memberId: message.author.id,
          messageId: message.id,
        },
      );
      return true;
    }

    const timer = this.schedule(() => {
      void this.deleteTemporaryReply(reply, message);
    }, SOFHIA_EASTER_EGG_DELETE_AFTER_MS);
    timer?.unref?.();
    return true;
  }

  async deleteTemporaryReply(reply, sourceMessage) {
    try {
      await reply.delete();
    } catch (error) {
      // Discord code 10008 means the temporary reply was already deleted.
      if (error?.code === 10_008) {
        return;
      }
      this.logger.warn(
        "SOFHIA_EASTER_EGG_DELETE_FAILED",
        "A temporary Sofhia easter-egg reply could not be deleted safely.",
        {
          guildId: sourceMessage.guildId,
          channelId: sourceMessage.channelId,
          messageId: reply?.id ?? null,
          error: error?.message,
        },
      );
    }
  }

  pruneCooldowns(now) {
    if (this.cooldowns.size < MAX_COOLDOWN_ENTRIES) {
      return;
    }

    for (const [key, expiresAt] of this.cooldowns) {
      if (now >= expiresAt) {
        this.cooldowns.delete(key);
      }
    }

    while (this.cooldowns.size >= MAX_COOLDOWN_ENTRIES) {
      const oldestKey = this.cooldowns.keys().next().value;
      this.cooldowns.delete(oldestKey);
    }
  }
}
