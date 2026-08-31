import { normalizeText } from "./normalize.js";
import { BUILTIN_RULES, CATEGORIES, CONTEXT_EXCEPTIONS, PRESETS } from "./words.js";

const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const normalizedTerm = (term) => normalizeText(term).spaced;
const compile = (rule, index) => Object.freeze({ ...rule, id: rule.id ?? `${rule.category}_${index + 1}`, normalized: rule.term ? normalizedTerm(rule.term) : null, regex: rule.pattern ? new RegExp(rule.pattern, "iu") : null });
const BUILTINS = Object.freeze(BUILTIN_RULES.map(compile));
const boundaryMatch = (text, term) => new RegExp(`(?:^|[^\\p{L}\\p{N}])${escape(term).replaceAll(" ", "\\s+")}(?:$|[^\\p{L}\\p{N}])`, "u").test(text);

export function defaultCategorySettings(preset = "moderate") {
  const enabled = new Set(PRESETS[preset] ?? PRESETS.moderate);
  return Object.fromEntries(Object.entries(CATEGORIES).map(([id, value]) => [id, { enabled: enabled.has(id), action: value.defaultAction }]));
}

export function detectContent(content, customWords = [], options = {}) {
  const normalized = normalizeText(content);
  const whitelist = customWords.filter((r) => (r.severity ?? r.tier) === 0).map((r) => normalizedTerm(r.term ?? r.word));
  if (whitelist.some((term) => boundaryMatch(normalized.spaced, term))) return Object.freeze({ matched: false, normalized, matches: [] });
  const custom = customWords.filter((r) => (r.severity ?? r.tier) > 0).map((r, i) => compile({ term: r.term ?? r.word, severity: r.severity ?? (5 - r.tier), category: r.category ?? "custom", confidence: r.confidence ?? 0.9, actionOverride: r.actionOverride }, i));
  const settings = options.categories ?? defaultCategorySettings(options.preset);
  const target = Boolean(options.targeted || options.mentionCount > 0 || /\b(?:you|your|you're|youre)\b/u.test(normalized.spaced));
  const matches = [];
  for (const rule of [...BUILTINS, ...custom]) {
    if (settings[rule.category]?.enabled === false) continue;
    const hit = rule.regex ? rule.regex.test(normalized.original) : boundaryMatch(normalized.spaced, rule.normalized) || boundaryMatch(normalized.deobfuscated, rule.normalized);
    if (!hit) continue;
    if ((CONTEXT_EXCEPTIONS[rule.normalized] ?? []).some((phrase) => normalized.spaced.includes(normalizedTerm(phrase)))) continue;
    if (rule.requiresTarget && !target) continue;
    let confidence = rule.confidence ?? 0.85;
    if (target && ["insults", "sexual_harassment", "threats", "toxic"].includes(rule.category)) confidence += 0.1;
    if (normalized.quoted) confidence -= rule.severity < 4 ? 0.35 : 0.15;
    if (confidence < (options.minimumConfidence ?? 0.65)) continue;
    matches.push(Object.freeze({ ...rule, confidence: Math.min(1, confidence) }));
  }
  matches.sort((a, b) => b.severity - a.severity || b.confidence - a.confidence || (b.normalized?.length ?? 0) - (a.normalized?.length ?? 0));
  const best = matches[0];
  return best ? Object.freeze({ matched: true, ...best, tier: 5 - best.severity, matches: Object.freeze(matches), normalized, targeted: target }) : Object.freeze({ matched: false, normalized, matches: Object.freeze([]) });
}

export function detectLinks(content) {
  const text = String(content ?? "");
  return Object.freeze({ invite: /(?:discord(?:app)?\.com\/invite|discord\.gg)\/[\w-]+/iu.test(text), link: /(?:https?:\/\/|www\.)[^\s<>]+/iu.test(text) });
}
