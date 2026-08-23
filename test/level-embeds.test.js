import test from "node:test";
import assert from "node:assert/strict";
import {
  buildLeaderboardEmbed,
  buildLevelUpEmbed,
  buildRankEmbed,
} from "../src/level/embeds.js";

const avatar = "https://cdn.discordapp.com/embed/avatars/0.png";
const clientUser = { displayAvatarURL: () => avatar };
const guild = {
  name: "Sofra *Garden*",
  iconURL: () => null,
};
const user = {
  username: "@Petal*",
  globalName: null,
  displayAvatarURL: () => avatar,
};

test("rank embeds are polished, escaped, and include XP progress", () => {
  const json = buildRankEmbed({
    user,
    stats: { xp: 100, rank: 2, awardedMessages: 5 },
    guild,
    clientUser,
  }).toJSON();

  assert.match(json.title, /@\u200bPetal\\\*/);
  assert.ok(json.fields.some((field) => field.name === "☁️ XP Progress"));
  assert.ok(json.fields.some((field) => field.value.includes("Level") || field.value.includes("XP")));
  assert.equal(json.footer.text, "Sofra ♡ Levels");
});

test("leaderboards show medals, levels, paging, and disabled mass mentions", () => {
  const json = buildLeaderboardEmbed({
    guild,
    leaderboard: {
      total: 12,
      rows: [{ rank: 1, userId: "1540628204333703198", xp: 450 }],
    },
    page: 1,
    pageSize: 10,
    clientUser,
  }).toJSON();

  assert.match(json.description, /🥇 <@1540628204333703198>/);
  assert.match(json.description, /Level/);
  assert.match(json.footer.text, /Page 1\/2/);
});

test("level-up previews clearly state that no data or roles changed", () => {
  const member = {
    toString: () => "<@1540628204333703198>",
    displayAvatarURL: () => avatar,
  };
  const json = buildLevelUpEmbed({
    member,
    level: 3,
    totalXp: 650,
    clientUser,
    preview: true,
  }).toJSON();

  assert.match(json.description, /Preview only/);
  assert.match(json.description, /no XP or roles were changed/);
});
