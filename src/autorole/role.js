import { PermissionFlagsBits } from "discord.js";

async function resolveBotMember(guild, clientUserId) {
  return guild.members.me ?? guild.members.fetch(clientUserId);
}

export async function fetchConfiguredRole(guild, roleId) {
  if (!roleId) {
    return null;
  }

  try {
    return guild.roles.cache.get(roleId) ?? (await guild.roles.fetch(roleId));
  } catch {
    return null;
  }
}

export async function inspectAutoRole({
  guild,
  role,
  clientUserId,
  actorId = null,
}) {
  const inspection = {
    role: role ?? null,
    exists: Boolean(role),
    sameGuild: false,
    assignableType: false,
    manageRoles: false,
    botAboveRole: false,
    actorAboveRole: actorId === null,
    valid: false,
    reason: "The configured role is missing or was deleted.",
  };

  if (!role) {
    return inspection;
  }

  if (role.guild?.id !== guild.id) {
    return { ...inspection, reason: "Choose a role from this server." };
  }
  inspection.sameGuild = true;

  if (role.id === guild.id) {
    return { ...inspection, reason: "The @everyone role cannot be assigned." };
  }

  if (role.managed) {
    return {
      ...inspection,
      reason: "Discord-managed and integration roles cannot be assigned by Sofra.",
    };
  }
  inspection.assignableType = true;

  let botMember;
  try {
    botMember = await resolveBotMember(guild, clientUserId);
  } catch {
    return {
      ...inspection,
      reason: "Sofra could not resolve her server membership to check permissions.",
    };
  }

  inspection.manageRoles = botMember.permissions.has(PermissionFlagsBits.ManageRoles);
  if (!inspection.manageRoles) {
    return { ...inspection, reason: "Sofra needs the Manage Roles permission." };
  }

  inspection.botAboveRole = botMember.roles.highest.comparePositionTo(role) > 0;
  if (!inspection.botAboveRole) {
    return {
      ...inspection,
      reason: "Move Sofra’s highest role above the configured auto-role.",
    };
  }

  if (actorId !== null) {
    let actorMember;
    try {
      actorMember = await guild.members.fetch(actorId);
    } catch {
      return {
        ...inspection,
        reason: "Sofra could not verify your role hierarchy.",
      };
    }

    inspection.actorAboveRole =
      actorMember.id === guild.ownerId ||
      actorMember.roles.highest.comparePositionTo(role) > 0;
    if (!inspection.actorAboveRole) {
      return {
        ...inspection,
        reason: "You cannot configure a role equal to or above your highest role.",
      };
    }
  }

  return {
    ...inspection,
    valid: true,
    reason: "The auto-role is ready to be assigned.",
  };
}
