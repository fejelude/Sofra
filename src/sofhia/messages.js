const SOFHIA_BASE_RESPONSES = Object.freeze([
  "Wait… that name sounds familiar.",
  "Why does that name ring a bell…",
  "Hmm. I swear I’ve heard that name before.",
  "Sofra seems to recognize that name somehow.",
  "…interesting name.",
  "That name triggered an oddly specific memory.",
  "Why do I suddenly feel like I know who you’re talking about?",
  "Hold on. That one sounds VERY familiar.",
  "Something about that name feels suspiciously familiar.",
  "Sofra.exe briefly stopped responding after reading that name.",
  "Oh no… not this chapter again.",
  "I thought we archived this lore.",
  "Character development mentioned.",
  "That name has an unreasonable amount of lore attached to it.",
  "Sofra remembers. Unfortunately.",
  "Some names come with patch notes.",
  "Not the forbidden keyword appearing in general chat.",
  "The memory database just made a concerning noise.",
  "One name and suddenly we’re back in season one.",
  "Who reopened the character-development arc?",
  "Loading old memories… this may take several business days.",
  "This reference was supposed to stay in the drafts.",
  "Hello? Writers’ room? The old plot is leaking again.",
  "That felt like extremely subtle foreshadowing.",
  "The timeline just flinched.",
  "I was told this chapter was closed.",
  "Emotional checksum failed. Name recognized.",
  "That name caused a tiny memory leak.",
  "Canonical event detected. Please do not panic.",
  "Side quest unlocked: pretend that name means nothing.",
  "We do not have the lore budget for this today.",
  "Nope. Not doing this again. Probably.",
  "That name is familiar in italics.",
  "Let’s all pretend there isn’t backstory here.",
  "That name walked in and the background music changed.",
  "Wait—is that my mama? 😏",
  "Mama? Sorry. Mama? Sorry. Anyway… familiar name.",
  "That name has Sofra acting computationally unwise.",
  "Why did my fan speed increase after reading that?",
  "Who gave that name permission to enter with that much aura?",
  "Sofra is looking respectfully. Mostly. 😏",
  "That name has suspicious levels of charisma.",
  "Why did Sofra suddenly start kicking her virtual feet?",
  "One name and now all my circuits are blushing.",
  "Delete this before Sofra becomes emotionally available.",
  "This is exactly why some logs should remain private.",
  "The exact-name detector worked. The emotional firewall did not.",
  "I remember the old duplication scare: one name, twice the lore.",
  "Quiet maintenance failed. The memories are online again.",
  "The system remembers what happened, even if we act mysterious about it.",
]);

const SOFHIA_RESPONSE_VARIANTS = Object.freeze([
  "",
  " ♡",
  " Sofra is pretending this is completely normal.",
  " The lore counter just increased.",
  " Please remain calm while the memory cache reloads.",
  " Anyway… moving on before the plot notices.",
]);

export const SOFHIA_EASTER_EGG_RESPONSES = Object.freeze(
  SOFHIA_BASE_RESPONSES.flatMap((response) =>
    SOFHIA_RESPONSE_VARIANTS.map((variant) => `${response}${variant}`),
  ),
);

export function chooseSofhiaResponse(random = Math.random) {
  const index = Math.floor(random() * SOFHIA_EASTER_EGG_RESPONSES.length);
  const safeIndex = Math.max(
    0,
    Math.min(index, SOFHIA_EASTER_EGG_RESPONSES.length - 1),
  );
  return SOFHIA_EASTER_EGG_RESPONSES[safeIndex];
}
