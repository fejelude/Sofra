export const CATEGORIES = Object.freeze({
  profanity: { label: "Profanity", emoji: "🗯️", defaultAction: "delete_warn" },
  severe_profanity: { label: "Severe Profanity", emoji: "⚠️", defaultAction: "delete_timeout_alert" },
  sexual: { label: "Sexual / Explicit Language", emoji: "🔞", defaultAction: "delete_warn" },
  sexual_harassment: { label: "Sexual Harassment", emoji: "🚷", defaultAction: "delete_timeout_alert" },
  insults: { label: "Insults / Harassment", emoji: "💢", defaultAction: "delete_warn" },
  hate: { label: "Hate / Slurs", emoji: "🚫", defaultAction: "delete_timeout_alert", redact: true },
  threats: { label: "Threatening Language", emoji: "🛡️", defaultAction: "delete_timeout_alert", redact: true },
  toxic: { label: "Toxic / Aggressive Language", emoji: "💬", defaultAction: "warn" },
  scam: { label: "Scam / Suspicious Language", emoji: "🔗", defaultAction: "delete_alert" },
  spam: { label: "Spam Language", emoji: "📨", defaultAction: "delete" },
  custom: { label: "Custom Blacklist", emoji: "📝", defaultAction: "delete_warn" },
});

export const ACTIONS = Object.freeze(["ignore", "log", "warn", "delete", "delete_warn", "delete_timeout", "delete_timeout_alert", "delete_kick", "delete_ban", "delete_alert", "strike"]);

export const PRESETS = Object.freeze({
  relaxed: ["severe_profanity", "sexual_harassment", "hate", "threats"],
  moderate: ["profanity", "severe_profanity", "sexual", "sexual_harassment", "insults", "hate", "threats", "scam", "custom"],
  strict: Object.keys(CATEGORIES),
});

const terms = (category, severity, values, extra = {}) => values.map((term) => ({ term, category, severity, confidence: 0.86, ...extra }));

// Data is intentionally separate from detection. Entries are whole words/phrases, never substrings.
export const BUILTIN_RULES = Object.freeze([
  ...terms("profanity", 1, ["damn", "dammit", "crap", "hell", "piss", "bloody hell", "wtf", "stfu", "ffs"]),
  ...terms("profanity", 2, ["ass", "shit", "shitty", "bullshit", "horseshit", "dipshit", "dumbass", "jackass", "asshole", "arsehole", "bitch", "bastard", "son of a bitch", "piece of shit", "what the fuck", "fck", "fuk", "fcking", "af", "lmfao"]),
  ...terms("severe_profanity", 3, ["fuck", "fucking", "fucker", "fuckface", "fuckhead", "fuckwit", "motherfucker", "motherfucking", "cunt", "cocksucker", "go fuck yourself", "fuck you", "shut the fuck up"]),
  ...terms("sexual", 2, ["dick", "cock", "pussy", "penis", "vagina", "vulva", "testicles", "ballsack", "tits", "titties", "boobs", "boobies", "cum", "jizz", "semen", "horny", "orgasm", "dildo", "vibrator", "blowjob", "handjob", "rimjob", "deepthroat", "porn", "porno", "nudes", "onlyfans", "jerk off", "jack off", "eat me out", "suck my dick", "send nudes", "show me your body"]),
  ...terms("sexual", 3, ["anal sex", "oral sex", "have sex", "wanna fuck", "want to fuck", "ride my dick", "sit on my face", "spread your legs", "make me cum"]),
  ...terms("sexual_harassment", 3, ["send me nudes", "show me your tits", "nice tits", "nice ass", "i want your body", "let me touch you", "i would fuck you", "you are making me horny", "get in my bed"], { requiresTarget: true }),
  ...terms("insults", 2, ["idiot", "moron", "imbecile", "loser", "dumbass", "scumbag", "piece of trash", "piece of garbage", "worthless", "pathetic", "disgusting person", "you suck", "nobody likes you", "go away forever", "shut your mouth"], { context: "targeted" }),
  ...terms("hate", 4, ["nigger", "nigga", "faggot", "kike", "chink", "spic", "wetback", "tranny", "retard", "raghead", "gook", "coon", "dyke"], { confidence: 0.99 }),
  ...terms("threats", 4, ["i will kill you", "i'm going to kill you", "im going to kill you", "i will hurt you", "i will shoot you", "i will stab you", "i will beat you", "you should die", "go kill yourself", "kys", "watch your back", "i know where you live"], { requiresTarget: true, confidence: 0.98 }),
  ...terms("toxic", 2, ["everyone hates you", "leave this server", "nobody wants you here", "you don't belong here", "you are a failure", "your opinion is worthless", "stop talking forever"], { context: "targeted" }),
  ...terms("scam", 3, ["free nitro", "discord nitro gift", "nitro giveaway", "steam gift", "claim your prize", "claim reward", "verify your account", "account verification", "scan this qr code", "free robux", "free v bucks", "limited giveaway", "dm me to claim", "click here to claim", "send your password", "send login code", "wallet seed phrase", "crypto giveaway"]),
  { id: "scam-login-link", pattern: "(?:verify|claim|login).{0,30}(?:https?://|www\\.)", category: "scam", severity: 4, confidence: 0.95 },
]);

export const CONTEXT_EXCEPTIONS = Object.freeze({
  dick: ["dick grayson", "dick van dyke", "dick cheney"],
  cock: ["cock a doodle", "cock-a-doodle", "rooster", "stopcock", "weathercock"],
  hell: ["hell's kitchen"],
});
