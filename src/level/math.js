export const DEFAULT_XP_MIN = 15;
export const DEFAULT_XP_MAX = 25;
export const DEFAULT_COOLDOWN_SECONDS = 60;
export const MAX_LEVEL = 10_000;

export function xpNeededForNextLevel(level) {
  const safeLevel = Math.max(0, Math.min(MAX_LEVEL, Math.trunc(level)));
  return 5 * safeLevel ** 2 + 50 * safeLevel + 100;
}

export function totalXpForLevel(level) {
  const safeLevel = Math.max(0, Math.min(MAX_LEVEL, Math.trunc(level)));
  if (safeLevel === 0) {
    return 0;
  }

  const previous = safeLevel - 1;
  const squares = (previous * safeLevel * (2 * safeLevel - 1)) / 6;
  return 5 * squares + 25 * previous * safeLevel + 100 * safeLevel;
}

export const MAX_TOTAL_XP = totalXpForLevel(MAX_LEVEL);

export function normalizeTotalXp(xp) {
  if (!Number.isFinite(xp)) {
    return 0;
  }

  return Math.max(0, Math.min(MAX_TOTAL_XP, Math.trunc(xp)));
}

export function levelFromXp(xp) {
  const safeXp = normalizeTotalXp(xp);
  let low = 0;
  let high = 1;

  while (high < MAX_LEVEL && totalXpForLevel(high) <= safeXp) {
    high = Math.min(MAX_LEVEL, high * 2);
  }

  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (totalXpForLevel(middle) <= safeXp) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }

  return low;
}

export function levelProgress(xp) {
  const totalXp = normalizeTotalXp(xp);
  const level = levelFromXp(totalXp);

  if (level >= MAX_LEVEL) {
    return Object.freeze({
      level,
      current: 0,
      needed: 0,
      remaining: 0,
      ratio: 1,
      percentage: 100,
    });
  }

  const levelStart = totalXpForLevel(level);
  const current = totalXp - levelStart;
  const needed = xpNeededForNextLevel(level);
  const ratio = needed === 0 ? 1 : current / needed;

  return Object.freeze({
    level,
    current,
    needed,
    remaining: Math.max(0, needed - current),
    ratio,
    percentage: Math.floor(ratio * 100),
  });
}

export function progressBar(ratio, segments = 10) {
  const safeSegments = Math.max(1, Math.min(20, Math.trunc(segments)));
  const filled = Math.max(
    0,
    Math.min(safeSegments, Math.round(Math.max(0, Math.min(1, ratio)) * safeSegments)),
  );
  return `${"▰".repeat(filled)}${"▱".repeat(safeSegments - filled)}`;
}
