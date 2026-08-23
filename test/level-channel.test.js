import test from "node:test";
import assert from "node:assert/strict";
import {
  ChannelType,
  PermissionsBitField,
  PermissionFlagsBits,
} from "discord.js";
import {
  inspectLevelChannel,
  inspectLevelChannelObject,
} from "../src/level/channel.js";

const GUILD_ID = "1540617362477162506";
const CHANNEL_ID = "1540628204333703198";
const BOT_ID = "1540628204333703199";

function fixture(type, bits) {
  const botMember = { id: BOT_ID };
  const channel = {
    id: CHANNEL_ID,
    guildId: GUILD_ID,
    type,
    send() {},
    permissionsFor: () => new PermissionsBitField(bits),
  };
  const guild = {
    id: GUILD_ID,
    channels: {
      cache: new Map([[CHANNEL_ID, channel]]),
      fetch: async () => channel,
    },
    members: { me: botMember, fetch: async () => botMember },
  };
  return { guild, channel };
}

test("regular notification channels require view, send, and embed permissions", async () => {
  const bits =
    PermissionFlagsBits.ViewChannel |
    PermissionFlagsBits.SendMessages |
    PermissionFlagsBits.EmbedLinks;
  const { guild } = fixture(ChannelType.GuildText, bits);
  const inspection = await inspectLevelChannel({
    guild,
    channelId: CHANNEL_ID,
    clientUserId: BOT_ID,
  });
  assert.equal(inspection.valid, true);
});

test("thread notifications require Send Messages in Threads", async () => {
  const missingThreadSend =
    PermissionFlagsBits.ViewChannel |
    PermissionFlagsBits.SendMessages |
    PermissionFlagsBits.EmbedLinks;
  const validThread =
    PermissionFlagsBits.ViewChannel |
    PermissionFlagsBits.SendMessagesInThreads |
    PermissionFlagsBits.EmbedLinks;
  const first = fixture(ChannelType.PublicThread, missingThreadSend);
  const second = fixture(ChannelType.PublicThread, validThread);

  assert.equal(
    (await inspectLevelChannelObject({
      guild: first.guild,
      channel: first.channel,
      clientUserId: BOT_ID,
    })).valid,
    false,
  );
  assert.equal(
    (await inspectLevelChannelObject({
      guild: second.guild,
      channel: second.channel,
      clientUserId: BOT_ID,
    })).valid,
    true,
  );
});

test("deleted notification channels fail without throwing", async () => {
  const { guild } = fixture(ChannelType.GuildText, 0n);
  guild.channels.cache.clear();
  guild.channels.fetch = async () => {
    throw new Error("Unknown Channel");
  };

  const inspection = await inspectLevelChannel({
    guild,
    channelId: CHANNEL_ID,
    clientUserId: BOT_ID,
  });
  assert.equal(inspection.exists, false);
  assert.equal(inspection.valid, false);
});
