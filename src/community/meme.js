import { randomInt } from "node:crypto";

const SAFE_SUBREDDITS = Object.freeze([
  "memes",
  "wholesomememes",
  "me_irl",
]);
const REQUEST_ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 6_000;

function httpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function validateMeme(payload) {
  if (
    !payload ||
    typeof payload !== "object" ||
    payload.nsfw !== false ||
    payload.spoiler === true ||
    !SAFE_SUBREDDITS.includes(String(payload.subreddit).toLowerCase())
  ) {
    return null;
  }

  const imageUrl = httpsUrl(payload.url);
  if (!imageUrl) {
    return null;
  }

  return Object.freeze({
    title: String(payload.title || "A little meme break ♡").slice(0, 256),
    imageUrl,
    postUrl: httpsUrl(payload.postLink),
    subreddit: String(payload.subreddit).slice(0, 50),
    author: String(payload.author || "unknown").slice(0, 100),
    upvotes: Number.isSafeInteger(payload.ups) ? Math.max(0, payload.ups) : 0,
  });
}

export async function fetchSafeMeme({ fetchImpl = globalThis.fetch } = {}) {
  let lastError = null;

  for (let attempt = 0; attempt < REQUEST_ATTEMPTS; attempt += 1) {
    const subreddit = SAFE_SUBREDDITS[randomInt(SAFE_SUBREDDITS.length)];
    try {
      const response = await fetchImpl(`https://meme-api.com/gimme/${subreddit}`, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) {
        throw new Error(`Meme API returned HTTP ${response.status}.`);
      }

      const meme = validateMeme(await response.json());
      if (meme) {
        return meme;
      }
      lastError = new Error("Meme API returned an unsafe or malformed result.");
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error("No safe meme was available after several attempts.", {
    cause: lastError,
  });
}

export { SAFE_SUBREDDITS };
