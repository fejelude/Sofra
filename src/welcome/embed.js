import { randomInt } from "node:crypto";
import { EmbedBuilder } from "discord.js";
import { WELCOME_MESSAGES } from "./messages.js";
import { renderWelcomeTemplate } from "./template.js";

export const SOFRA_COLORS = Object.freeze([
  0xf4a7c2,
  0xf8c8d8,
  0xd8b4e8,
  0xe8c7dc,
  0xffd9e6,
]);

export function chooseWelcomeMessage() {
  return WELCOME_MESSAGES[randomInt(WELCOME_MESSAGES.length)];
}

export function chooseSofraColor() {
  return SOFRA_COLORS[randomInt(SOFRA_COLORS.length)];
}

function resolveColor(color) {
  if (typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color)) {
    return Number.parseInt(color.slice(1), 16);
  }
  return Number.isInteger(color) ? color : chooseSofraColor();
}

export function buildWelcomeEmbed({
  member,
  clientUser,
  messageTemplate = chooseWelcomeMessage(),
  titleTemplate = "Welcome to {server.name}! 🎀",
  descriptionTemplate = null,
  color = chooseSofraColor(),
  imageUrl = null,
  thumbnailMode = "member",
  now = new Date(),
}) {
  const guildIcon = member.guild.iconURL({ extension: "png", size: 256 });
  const botAvatar = clientUser.displayAvatarURL({ extension: "png", size: 128 });
  const memberAvatar = member.displayAvatarURL({ extension: "png", size: 512 });
  const memberMention = renderWelcomeTemplate("{user.mention}", member);
  const title = renderWelcomeTemplate(titleTemplate || "Welcome to {server.name}! 🎀", member);
  const description = renderWelcomeTemplate(descriptionTemplate || messageTemplate, member);

  const embed = new EmbedBuilder()
    .setColor(resolveColor(color))
    .setAuthor({
      name: "♡ Sofra Welcomes You",
      iconURL: guildIcon ?? botAvatar,
    })
    .setTitle(title)
    .setDescription(description)
    .addFields(
      {
        name: "🌸 Member",
        value: memberMention,
        inline: true,
      },
      {
        name: "୨୧ Member Count",
        value: `You’re member #${member.guild.memberCount.toLocaleString("en-US")}`,
        inline: true,
      },
    )
    .setFooter({
      text: "Sofra ♡ Welcome",
      iconURL: botAvatar,
    })
    .setTimestamp(now);

  if (thumbnailMode !== "none") {
    embed.setThumbnail(memberAvatar);
  }
  if (typeof imageUrl === "string" && imageUrl.startsWith("https://")) {
    embed.setImage(imageUrl);
  }

  return embed;
}
