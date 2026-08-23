import { escapeMarkdown } from "discord.js";

export const SUPPORTED_PLACEHOLDERS = Object.freeze([
  "{user.mention}",
  "{user.name}",
  "{user.avatar}",
  "{server.name}",
  "{server.member_count}",
  "{server.icon}",
]);

function safeName(value) {
  return escapeMarkdown(String(value)).replaceAll("@", "@\u200b");
}

export function welcomeTemplateValues(member) {
  const avatar = member.displayAvatarURL({ extension: "png", size: 512 });
  const serverIcon = member.guild.iconURL({ extension: "png", size: 256 }) ?? "";

  return Object.freeze({
    "{user.mention}": `<@${member.id}>`,
    "{user.name}": safeName(member.user.username),
    "{user.avatar}": avatar,
    "{server.name}": safeName(member.guild.name),
    "{server.member_count}": String(member.guild.memberCount),
    "{server.icon}": serverIcon,
  });
}

export function renderWelcomeTemplate(template, member) {
  const values = welcomeTemplateValues(member);
  let rendered = String(template);

  for (const placeholder of SUPPORTED_PLACEHOLDERS) {
    rendered = rendered.replaceAll(placeholder, values[placeholder]);
  }

  return rendered;
}
