// Deliberately compact, high-confidence defaults. Guild overrides live in SQLite.
// Tier 1 is zero-tolerance hate; tier 2 is strong profanity; tier 3 is mild.
export const DEFAULT_WORDS = Object.freeze([
  { term: "nigger", tier: 1, category: "racial slur" },
  { term: "nigga", tier: 1, category: "racial slur" },
  { term: "faggot", tier: 1, category: "homophobic slur" },
  { term: "kike", tier: 1, category: "antisemitic slur" },
  { term: "chink", tier: 1, category: "racial slur" },
  { term: "spic", tier: 1, category: "racial slur" },
  { term: "puta", tier: 2, category: "strong profanity" },
  { term: "putain", tier: 2, category: "strong profanity" },
  { term: "mierda", tier: 2, category: "strong profanity" },
  { term: "scheisse", tier: 2, category: "strong profanity" },
  { term: "сука", tier: 2, category: "strong profanity" },
  { term: "блять", tier: 2, category: "strong profanity" },
  { term: "fuck", tier: 2, category: "strong profanity" },
  { term: "motherfucker", tier: 2, category: "strong profanity" },
  { term: "cunt", tier: 2, category: "strong profanity" },
  { term: "bitch", tier: 3, category: "mild profanity" },
  { term: "asshole", tier: 3, category: "mild profanity" },
  { term: "shit", tier: 3, category: "mild profanity" },
  { term: "ass", tier: 3, category: "mild profanity" },
]);
