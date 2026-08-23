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

export function buildWelcomeEmbed({
  member,
  clientUser,
  messageTemplate = chooseWelcomeMessage(),
  color = chooseSofraColor(),
  now = new Date(),
}) {
  const guildIcon = member.guild.iconURL({ extension: "png", size: 256 });
  const botAvatar = clientUser.displayAvatarURL({ extension: "png", size: 128 });
  const memberAvatar = member.displayAvatarURL({ extension: "png", size: 512 });
  const serverName = renderWelcomeTemplate("{server.name}", member);
  const memberMention = renderWelcomeTemplate("{user.mention}", member);

  return new EmbedBuilder()
    .setColor(color)
    .setAuthor({
      name: "♡ Sofra Welcomes You",
      iconURL: guildIcon ?? botAvatar,
    })
    .setTitle(`Welcome to ${serverName}! 🎀`)
    .setDescription(renderWelcomeTemplate(messageTemplate, member))
    .setThumbnail(memberAvatar)
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
}
