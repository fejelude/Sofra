import { PermissionFlagsBits } from "discord.js";

async function resolveBotMember(guild, clientUserId) {
  return guild.members.me ?? guild.members.fetch(clientUserId);
}

export async function inspectRewardRole({
  guild,
  role,
  actorId,
  clientUserId,
}) {
  if (!role || role.guild.id !== guild.id) {
    return { valid: false, reason: "Choose a role from this server." };
  }

  if (role.id === guild.id) {
    return { valid: false, reason: "The @everyone role cannot be a level reward." };
  }

  if (role.managed) {
    return { valid: false, reason: "Discord-managed roles cannot be awarded by Sofra." };
  }

  let botMember;
  let actorMember;

  try {
    [botMember, actorMember] = await Promise.all([
      resolveBotMember(guild, clientUserId),
      guild.members.fetch(actorId),
    ]);
  } catch {
    return {
      valid: false,
      reason: "Sofra could not resolve the required server members to check role hierarchy.",
    };
  }

  if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return { valid: false, reason: "Sofra needs the Manage Roles permission." };
  }

  if (botMember.roles.highest.comparePositionTo(role) <= 0) {
    return {
      valid: false,
      reason: "Move Sofra’s highest role above this reward role.",
    };
  }

  if (
    actorMember.id !== guild.ownerId &&
    actorMember.roles.highest.comparePositionTo(role) <= 0
  ) {
    return {
      valid: false,
      reason: "You cannot configure a role equal to or above your highest role.",
    };
  }

  return { valid: true, reason: "The reward role is manageable." };
}

export async function grantEligibleRoleRewards({ member, rewards, level, logger }) {
  const eligible = rewards.filter((reward) => reward.requiredLevel <= level);
  if (eligible.length === 0) {
    return [];
  }

  let botMember;
  try {
    botMember = await resolveBotMember(member.guild, member.client.user.id);
  } catch {
    botMember = null;
  }
  if (!botMember?.permissions.has(PermissionFlagsBits.ManageRoles)) {
    logger.warn(
      "LEVEL_ROLE_REWARD_SKIPPED",
      "Sofra cannot award level roles because Manage Roles is missing.",
      { guildId: member.guild.id, memberId: member.id },
    );
    return [];
  }

  const assignable = [];

  for (const reward of eligible) {
    if (member.roles.cache.has(reward.roleId)) {
      continue;
    }

    let role = member.guild.roles.cache.get(reward.roleId);
    if (!role) {
      try {
        role = await member.guild.roles.fetch(reward.roleId);
      } catch {
        role = null;
      }
    }

    if (
      !role ||
      role.managed ||
      role.id === member.guild.id ||
      botMember.roles.highest.comparePositionTo(role) <= 0
    ) {
      logger.warn(
        "LEVEL_ROLE_REWARD_INVALID",
        "A configured level reward role is missing or outside Sofra’s hierarchy.",
        {
          guildId: member.guild.id,
          memberId: member.id,
          roleId: reward.roleId,
          requiredLevel: reward.requiredLevel,
        },
      );
      continue;
    }

    assignable.push(role);
  }

  if (assignable.length === 0) {
    return [];
  }

  try {
    await member.roles.add(
      assignable,
      `Sofra level rewards unlocked at level ${level}`,
    );
    return assignable;
  } catch (error) {
    logger.error(
      "LEVEL_ROLE_REWARD_FAILED",
      "Discord rejected an automatic level role assignment.",
      error,
      {
        guildId: member.guild.id,
        memberId: member.id,
        roleIds: assignable.map((role) => role.id),
      },
    );
    return [];
  }
}
