import { EmbedBuilder, escapeMarkdown } from "discord.js";
import { levelFromXp, levelProgress, progressBar } from "./math.js";

export const LEVEL_COLORS = Object.freeze([
  0xf4a7c2,
  0xf8c8d8,
  0xd8b4e8,
  0xe8c7dc,
  0xffd9e6,
]);

export function formatXp(value) {
  return Math.max(0, Number(value) || 0).toLocaleString("en-US");
}

function safeName(value) {
  return escapeMarkdown(String(value)).replaceAll("@", "@\u200b");
}

function userDisplayName(user) {
  return safeName(user.globalName ?? user.username ?? "Member");
}

function progressText(xp) {
  const progress = levelProgress(xp);
  if (progress.needed === 0) {
    return `${progressBar(1)} **Maximum level reached**`;
  }

  return `${progressBar(progress.ratio)} **${progress.percentage}%**\n${formatXp(
    progress.current,
  )} / ${formatXp(progress.needed)} XP to the next level`;
}

export function buildRankEmbed({ user, stats, guild, clientUser }) {
  const level = levelFromXp(stats.xp);
  const rank = stats.rank ? `#${formatXp(stats.rank)}` : "Unranked";

  return new EmbedBuilder()
    .setColor(LEVEL_COLORS[0])
    .setAuthor({
      name: "♡ Sofra Levels",
      iconURL: guild.iconURL({ extension: "png", size: 128 }) ??
        clientUser.displayAvatarURL({ extension: "png", size: 128 }),
    })
    .setTitle(`${userDisplayName(user)}’s Rank 🎀`)
    .setThumbnail(user.displayAvatarURL({ extension: "png", size: 256 }))
    .addFields(
      { name: "🌸 Level", value: `**${formatXp(level)}**`, inline: true },
      { name: "୨୧ Server Rank", value: `**${rank}**`, inline: true },
      { name: "✨ Total XP", value: `**${formatXp(stats.xp)}**`, inline: true },
      {
        name: "☁️ XP Progress",
        value: progressText(stats.xp),
        inline: false,
      },
      {
        name: "🫧 XP-Earning Messages",
        value: formatXp(stats.awardedMessages),
        inline: true,
      },
    )
    .setFooter({ text: "Sofra ♡ Levels" })
    .setTimestamp();
}

function rankPrefix(rank) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `**#${rank}**`;
}

export function buildLeaderboardEmbed({
  guild,
  leaderboard,
  page,
  pageSize,
  clientUser,
}) {
  const totalPages = Math.max(1, Math.ceil(leaderboard.total / pageSize));
  const description =
    leaderboard.rows.length === 0
      ? "No one has earned XP yet. Start chatting and the leaderboard will bloom here 🌸"
      : leaderboard.rows
          .map((entry) => {
            const level = levelFromXp(entry.xp);
            return `${rankPrefix(entry.rank)} <@${entry.userId}>\n> Level **${formatXp(
              level,
            )}** • ${formatXp(entry.xp)} XP`;
          })
          .join("\n\n");

  return new EmbedBuilder()
    .setColor(LEVEL_COLORS[2])
    .setAuthor({
      name: "♡ Sofra Levels",
      iconURL: guild.iconURL({ extension: "png", size: 128 }) ??
        clientUser.displayAvatarURL({ extension: "png", size: 128 }),
    })
    .setTitle(`୨୧ ${safeName(guild.name)} Leaderboard`)
    .setDescription(description)
    .setFooter({
      text: `Sofra ♡ Levels • Page ${page}/${totalPages}`,
      iconURL: clientUser.displayAvatarURL({ extension: "png", size: 128 }),
    })
    .setTimestamp();
}

export function buildRewardsEmbed({ guild, rewards, clientUser }) {
  const visibleRewards = rewards.slice(0, 25);
  let description =
    visibleRewards.length === 0
      ? "No automatic role rewards have been configured yet."
      : visibleRewards
          .map(
            (reward) =>
              `🌸 **Level ${formatXp(reward.requiredLevel)}**  →  <@&${reward.roleId}>`,
          )
          .join("\n");

  if (rewards.length > visibleRewards.length) {
    description += `\n\n*…and ${rewards.length - visibleRewards.length} more rewards.*`;
  }

  return new EmbedBuilder()
    .setColor(LEVEL_COLORS[3])
    .setAuthor({
      name: "♡ Sofra Levels",
      iconURL: guild.iconURL({ extension: "png", size: 128 }) ??
        clientUser.displayAvatarURL({ extension: "png", size: 128 }),
    })
    .setTitle("🎀 Level Role Rewards")
    .setDescription(description)
    .setFooter({ text: "Roles are cumulative and unlock automatically ♡" })
    .setTimestamp();
}

export function buildLevelUpEmbed({
  member,
  level,
  totalXp,
  assignedRoles = [],
  clientUser,
  preview = false,
}) {
  const progress = levelProgress(totalXp);
  const roleText =
    assignedRoles.length > 0
      ? `\n\n🎀 **Unlocked:** ${assignedRoles.map((role) => `<@&${role.id}>`).join(", ")}`
      : "";
  const previewText = preview ? "\n\n*Preview only—no XP or roles were changed.*" : "";

  return new EmbedBuilder()
    .setColor(LEVEL_COLORS[level % LEVEL_COLORS.length])
    .setAuthor({
      name: "✦ Sofra Level Up",
      iconURL: clientUser.displayAvatarURL({ extension: "png", size: 128 }),
    })
    .setTitle(`Level ${formatXp(level)} reached! ✨`)
    .setDescription(
      `${member} just reached **Level ${formatXp(level)}** ♡\n` +
        `Keep chatting and making the community brighter!${roleText}${previewText}`,
    )
    .setThumbnail(member.displayAvatarURL({ extension: "png", size: 256 }))
    .addFields(
      { name: "🌸 Total XP", value: formatXp(totalXp), inline: true },
      {
        name: "୨୧ Next Level",
        value: progress.remaining === 0
          ? "Maximum level"
          : `${formatXp(progress.remaining)} XP remaining`,
        inline: true,
      },
      { name: "☁️ Progress", value: progressText(totalXp), inline: false },
    )
    .setFooter({ text: "Sofra ♡ Levels" })
    .setTimestamp();
}
