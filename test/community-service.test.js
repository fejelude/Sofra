import test from "node:test";
import assert from "node:assert/strict";
import {
  ChannelType,
  Collection,
  PermissionsBitField,
  PermissionFlagsBits,
} from "discord.js";
import { CommunityService, parseColor } from "../src/community/service.js";

const GUILD_ID = "1540617362477162506";
const BOT_ID = "1540628204333703198";
const USER_ID = "1540628204333703199";
const CHANNEL_ID = "1540628204333703200";
const avatar = "https://cdn.discordapp.com/embed/avatars/0.png";

function fixture() {
  const logger = { info() {}, warn() {}, error() {} };
  const client = { user: { id: BOT_ID, displayAvatarURL: () => avatar } };
  const service = new CommunityService({
    client,
    logger,
    memeFetcher: async () => ({
      title: "Safe meme",
      imageUrl: "https://i.redd.it/meme.png",
      postUrl: null,
      subreddit: "memes",
      upvotes: 10,
    }),
  });
  const botMember = { id: BOT_ID };
  const user = {
    id: USER_ID,
    username: "Petal",
    displayName: "Petal",
    createdTimestamp: 1_600_000_000_000,
    displayAvatarURL: () => avatar,
  };
  const member = {
    id: USER_ID,
    user,
    displayName: "Petal",
    displayColor: 0xf4a7c2,
    joinedTimestamp: 1_700_000_000_000,
    roles: { cache: new Collection([[GUILD_ID, { id: GUILD_ID, position: 0 }]]) },
  };
  const guild = {
    id: GUILD_ID,
    name: "Sofra Garden",
    ownerId: USER_ID,
    memberCount: 10,
    premiumTier: 1,
    premiumSubscriptionCount: 2,
    createdTimestamp: 1_500_000_000_000,
    iconURL: () => null,
    members: { me: botMember, fetch: async () => member, cache: new Collection() },
    channels: { cache: new Collection(), fetch: async () => null },
    roles: { cache: new Collection([[GUILD_ID, { id: GUILD_ID }]]) },
    fetchOwner: async () => member,
  };
  return { service, guild, user, member };
}

test("embed builder accepts Sofra colors and rejects malformed hex values", () => {
  assert.equal(parseColor("#F4A7C2"), 0xf4a7c2);
  assert.equal(parseColor(""), 0xf4a7c2);
  assert.equal(parseColor("pink"), null);
});

test("userinfo shows account creation, join date, and roles", async () => {
  const { service, guild, user } = fixture();
  let reply;
  const interaction = {
    guild,
    user,
    options: { getUser: () => user },
    editReply: async (value) => {
      reply = value;
    },
  };

  await service.userinfo(interaction);
  const json = reply.embeds[0].toJSON();
  assert.deepEqual(
    json.fields.map((field) => field.name),
    ["🌸 User", "🎀 Account Created", "☁️ Joined Server", "✨ Roles (0)"],
  );
});

test("poll uses Discord-native single-choice voting with a 24-hour default", async () => {
  const { service, guild, user } = fixture();
  let reply;
  const values = {
    question: "Which update next?",
    "option-1": "Cars",
    "option-2": "Maps",
  };
  const interaction = {
    guild,
    user,
    memberPermissions: { has: () => true },
    channel: {
      permissionsFor: () =>
        new PermissionsBitField(
          PermissionFlagsBits.SendMessages | PermissionFlagsBits.SendPolls,
        ),
    },
    options: {
      getString: (name) => values[name] ?? null,
      getInteger: () => null,
    },
    reply: async (value) => {
      reply = value;
    },
  };

  await service.poll(interaction);
  assert.equal(reply.poll.duration, 24);
  assert.equal(reply.poll.allowMultiselect, false);
  assert.deepEqual(reply.poll.answers.map((answer) => answer.text), ["Cars", "Maps"]);
});

test("embed command opens a five-field modal for a valid destination", async () => {
  const { service, guild, user } = fixture();
  let modal;
  const channel = {
    id: CHANNEL_ID,
    guildId: GUILD_ID,
    type: ChannelType.GuildText,
    send: async () => {},
  };
  const interaction = {
    guild,
    user,
    channel,
    memberPermissions: { has: () => true },
    options: { getChannel: () => channel },
    showModal: async (value) => {
      modal = value;
    },
  };

  await service.openEmbedModal(interaction);
  const json = modal.toJSON();
  assert.equal(json.custom_id, `sofra_embed:${CHANNEL_ID}`);
  assert.equal(json.components.length, 5);
});

test("meme command renders validated results without requiring a post URL", async () => {
  const { service } = fixture();
  let reply;
  await service.meme({
    editReply: async (value) => {
      reply = value;
    },
  });
  const json = reply.embeds[0].toJSON();
  assert.equal(json.title, "Safe meme");
  assert.equal(json.image.url, "https://i.redd.it/meme.png");
  assert.equal(json.url, undefined);
});
