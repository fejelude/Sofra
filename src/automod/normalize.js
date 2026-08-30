const ZERO_WIDTH = /[\u00ad\u034f\u061c\u115f\u1160\u17b4\u17b5\u180e\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/gu;
const URL = /(?:https?:\/\/|www\.)\S+/giu;
const HOMOGLYPHS = Object.freeze({ "@": "a", "4": "a", "а": "a", "8": "b", "3": "e", "е": "e", "1": "i", "!": "i", "і": "i", "0": "o", "о": "o", "$": "s", "5": "s", "ѕ": "s", "7": "t", "+": "t" });

export function normalizeText(input) {
  const original = String(input ?? "");
  const withoutUrls = original.replace(URL, " ").replace(ZERO_WIDTH, "").normalize("NFKD").replace(/\p{M}+/gu, "").toLocaleLowerCase("und");
  const mapped = [...withoutUrls].map((character) => HOMOGLYPHS[character] ?? character).join("");
  const spaced = mapped.replace(/[^\p{L}\p{N}]+/gu, " ").replace(/(.)\1{2,}/gu, "$1").trim().replace(/\s+/g, " ");
  return Object.freeze({ original, spaced, compact: spaced.replaceAll(" ", "") });
}
