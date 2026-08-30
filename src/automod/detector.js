import { normalizeText } from "./normalize.js";
import { DEFAULT_WORDS } from "./words.js";

function normalizedTerm(term) { return normalizeText(term).compact; }
function hasTerm(normalized, term) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}(?:$|[^\\p{L}\\p{N}])`, "u").test(normalized.spaced)) return true;
  // Compact matching catches f.u.c.k but is restricted to longer terms and token edges.
  return term.length >= 4 && new RegExp(`(?:^|[^\\p{L}\\p{N}])${term}(?:$|[^\\p{L}\\p{N}])`, "u").test(` ${normalized.compact} `);
}

export function detectContent(content, customWords = []) {
  const normalized = normalizeText(content);
  const whitelist = new Set(customWords.filter((word) => word.tier === 0).map((word) => normalizedTerm(word.word)));
  const rules = [...customWords.filter((word) => word.tier > 0).map((word) => ({ term: word.word, tier: word.tier, category: "server custom rule" })), ...DEFAULT_WORDS]
    .map((rule) => ({ ...rule, normalized: normalizedTerm(rule.term) }))
    .filter((rule) => rule.normalized && !whitelist.has(rule.normalized))
    .sort((a, b) => a.tier - b.tier || b.normalized.length - a.normalized.length);
  const match = rules.find((rule) => hasTerm(normalized, rule.normalized));
  return match ? Object.freeze({ matched: true, tier: match.tier, category: match.category, term: match.term, normalized }) : Object.freeze({ matched: false, normalized });
}

export function detectLinks(content) {
  const text = String(content ?? "");
  return Object.freeze({ invite: /(?:discord(?:app)?\.com\/invite|discord\.gg)\/[\w-]+/iu.test(text), link: /(?:https?:\/\/|www\.)[^\s<>]+/iu.test(text) });
}
