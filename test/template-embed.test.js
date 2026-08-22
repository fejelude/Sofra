import test from "node:test";
import assert from "node:assert/strict";
import { buildWelcomeEmbed } from "../src/welcome/embed.js";
import {
  renderWelcomeTemplate,
  welcomeTemplateValues,
} from "../src/welcome/template.js";

const MEMBER_ID = "123456789012345678";
const MEMBER_AVATAR = "https://cdn.discordapp.com/embed/avatars/0.png";
const BOT_AVATAR = "https://cdn.discordapp.com/embed/avatars/1.png";

function memberFixture() {
  return {
    id: MEMBER_ID,
    user: { username: "@everyone **Ada**" },
    displayAvatarURL: () => MEMBER_AVATAR,
    guild: {
      name: "*Sofra* @here",
      memberCount: 42,
      iconURL: () => null,
    },
  };
}

test("renderer safely replaces every supported placeholder", () => {
  const member = memberFixture();
  const values = welcomeTemplateValues(member);
  const template = [
    "{user.mention}",
    "{user.name}",
    "{user.avatar}",
    "{server.name}",
    "{server.member_count}",
    "{server.icon}",
  ].join(" | ");
  const rendered = renderWelcomeTemplate(template, member);

  assert.equal(values["{user.mention}"], `<@${MEMBER_ID}>`);
  assert.match(values["{user.name}"], /@\u200beveryone/);
  assert.match(values["{user.name}"], /\\\*\\\*Ada\\\*\\\*/);
  assert.equal(values["{user.avatar}"], MEMBER_AVATAR);
  assert.equal(values["{server.member_count}"], "42");
  assert.equal(values["{server.icon}"], "");
  assert.doesNotMatch(rendered, /\{[^}]+\}/);
});

test("welcome embed includes the aesthetic layout and default avatar URL", () => {
  const member = memberFixture();
  const now = new Date("2026-08-23T00:00:00.000Z");
  const embed = buildWelcomeEmbed({
    member,
    clientUser: { displayAvatarURL: () => BOT_AVATAR },
    messageTemplate: "welcome, {user.mention}! enjoy {server.name} ♡",
    color: 0xf4a7c2,
    now,
  }).toJSON();

  assert.equal(embed.color, 0xf4a7c2);
  assert.equal(embed.author.name, "♡ Sofra Welcomes You");
  assert.equal(embed.author.icon_url, BOT_AVATAR);
  assert.equal(embed.thumbnail.url, MEMBER_AVATAR);
  assert.match(embed.title, /^Welcome to /);
  assert.match(embed.description, new RegExp(`<@${MEMBER_ID}>`));
  assert.equal(embed.fields[0].name, "🌸 Member");
  assert.equal(embed.fields[0].value, `<@${MEMBER_ID}>`);
  assert.equal(embed.fields[1].value, "You’re member #42");
  assert.equal(embed.footer.text, "Sofra ♡ Welcome");
  assert.equal(embed.timestamp, now.toISOString());
});
