import test from "node:test";
import assert from "node:assert/strict";
import {
  ChannelType,
  PermissionsBitField,
  PermissionFlagsBits,
} from "discord.js";
import { inspectWelcomeChannel } from "../src/welcome/permissions.js";

const GUILD_ID = "123456789012345678";
const CHANNEL_ID = "223456789012345678";
const BOT_ID = "323456789012345678";

function fixtures(permissionBits, { type = ChannelType.GuildText, fetchError = null } = {}) {
  const botMember = { id: BOT_ID };
  const channel = {
    id: CHANNEL_ID,
    guildId: GUILD_ID,
    type,
    send() {},
    permissionsFor: () => new PermissionsBitField(permissionBits),
  };
  const guild = {
    id: GUILD_ID,
    channels: {
      cache: new Map(fetchError ? [] : [[CHANNEL_ID, channel]]),
      fetch: async () => {
        if (fetchError) throw fetchError;
        return channel;
      },
    },
    members: {
      me: botMember,
      fetch: async () => botMember,
    },
  };
  return { guild, channel };
}

test("channel inspection reports all required permissions", async () => {
  const bits =
    PermissionFlagsBits.ViewChannel |
    PermissionFlagsBits.SendMessages |
    PermissionFlagsBits.EmbedLinks;
  const { guild } = fixtures(bits);

  const inspection = await inspectWelcomeChannel({
    guild,
    channelId: CHANNEL_ID,
    clientUserId: BOT_ID,
  });

  assert.equal(inspection.exists, true);
  assert.equal(inspection.viewChannel, true);
  assert.equal(inspection.sendMessages, true);
  assert.equal(inspection.embedLinks, true);
  assert.equal(inspection.valid, true);
});

test("missing Embed Links makes the configuration invalid", async () => {
  const bits = PermissionFlagsBits.ViewChannel | PermissionFlagsBits.SendMessages;
  const { guild } = fixtures(bits);

  const inspection = await inspectWelcomeChannel({
    guild,
    channelId: CHANNEL_ID,
    clientUserId: BOT_ID,
  });

  assert.equal(inspection.embedLinks, false);
  assert.equal(inspection.valid, false);
});

test("deleted/inaccessible and unsupported channels fail gracefully", async () => {
  const deleted = fixtures(0n, { fetchError: new Error("Unknown Channel") });
  const missing = await inspectWelcomeChannel({
    guild: deleted.guild,
    channelId: CHANNEL_ID,
    clientUserId: BOT_ID,
  });
  assert.equal(missing.exists, false);
  assert.equal(missing.valid, false);

  const unsupported = fixtures(PermissionFlagsBits.Administrator, {
    type: ChannelType.GuildVoice,
  });
  const invalidType = await inspectWelcomeChannel({
    guild: unsupported.guild,
    channelId: CHANNEL_ID,
    clientUserId: BOT_ID,
  });
  assert.equal(invalidType.exists, true);
  assert.equal(invalidType.supportedType, false);
  assert.equal(invalidType.valid, false);
});
