import test from "node:test";
import assert from "node:assert/strict";
import { fetchSafeMeme, SAFE_SUBREDDITS } from "../src/community/meme.js";

function subredditFromUrl(url) {
  return new URL(url).pathname.split("/").at(-1).toLowerCase();
}

test("meme fetcher returns only validated HTTPS SFW results", async () => {
  const meme = await fetchSafeMeme({
    fetchImpl: async (url) => ({
      ok: true,
      status: 200,
      json: async () => ({
        title: "A safe meme",
        url: "https://i.redd.it/example.png",
        postLink: "https://redd.it/example",
        subreddit: subredditFromUrl(url),
        author: "petal",
        ups: 42,
        nsfw: false,
        spoiler: false,
      }),
    }),
  });

  assert.equal(meme.title, "A safe meme");
  assert.equal(meme.imageUrl, "https://i.redd.it/example.png");
  assert.ok(SAFE_SUBREDDITS.includes(meme.subreddit));
});

test("unsafe and malformed meme results are retried then rejected", async () => {
  let attempts = 0;
  await assert.rejects(
    fetchSafeMeme({
      fetchImpl: async (url) => {
        attempts += 1;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            title: "Unsafe",
            url: "http://insecure.example/meme.png",
            subreddit: subredditFromUrl(url),
            nsfw: true,
            spoiler: false,
          }),
        };
      },
    }),
    /No safe meme/,
  );
  assert.equal(attempts, 3);
});

test("temporary HTTP failures are retried", async () => {
  let attempts = 0;
  const meme = await fetchSafeMeme({
    fetchImpl: async (url) => {
      attempts += 1;
      if (attempts < 3) return { ok: false, status: 503 };
      return {
        ok: true,
        status: 200,
        json: async () => ({
          title: "Recovered",
          url: "https://i.redd.it/recovered.png",
          subreddit: subredditFromUrl(url),
          nsfw: false,
          spoiler: false,
          ups: 1,
        }),
      };
    },
  });
  assert.equal(attempts, 3);
  assert.equal(meme.title, "Recovered");
});
