export const SOFHIA_REACTION_GIF_CHANCE = 0.25;

export const SOFHIA_REACTION_GIFS = Object.freeze([
  Object.freeze({
    mood: "shocked",
    responseMoods: Object.freeze(["shocked", "funny", "dramatic", "natural"]),
    url: "https://media0.giphy.com/media/v1.Y2lkPTZjMDliOTUyMDFrOWZ4ZDI0emEyODQxODZpem50OWllcHg4dWF6aG92d2d5anZiMSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/cGtQdFzemzLihopw35/source.gif",
  }),
  Object.freeze({
    mood: "awkward silence",
    responseMoods: Object.freeze(["awkward", "shocked", "natural"]),
    url: "https://media4.giphy.com/media/v1.Y2lkPTZjMDliOTUycnR6YXN2NTl6d3BoYzQxdWV3b2FsNTEwazV3MTJrZ2hpOWpiNWVvdiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/K5NLYLm3FL1GUTQ93j/giphy.gif",
  }),
  Object.freeze({
    mood: "staring into space",
    responseMoods: Object.freeze(["nostalgic", "awkward", "natural"]),
    url: "https://c.tenor.com/sOovSLmxwKkAAAAC/looking-afar-swae-lee.gif",
  }),
  Object.freeze({
    mood: "quietly remembering",
    responseMoods: Object.freeze(["nostalgic", "natural"]),
    url: "https://media4.giphy.com/media/v1.Y2lkPTZjMDliOTUyeTQ3cTdjdTVzcG02NWR3ZXowa2c0MHU2YzlocjV2bWk5eHN0bjlrcyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/MZQkUm97KTI1gI8sUj/giphy.gif",
  }),
  Object.freeze({
    mood: "laughing while crying",
    responseMoods: Object.freeze(["funny", "dramatic", "shocked"]),
    url: "https://gifdb.com/images/high/happy-tears-laugh-cry-wx2g97mnbynm3uaz.gif",
  }),
  Object.freeze({
    mood: "trying not to cry",
    responseMoods: Object.freeze(["nostalgic", "dramatic", "natural"]),
    url: "https://gifdb.com/images/high/cuba-gooding-trying-not-to-cry-in-movie-clip-p13y4cl69ozz0421.gif",
  }),
  Object.freeze({
    mood: "flashback",
    responseMoods: Object.freeze(["funny", "nostalgic", "dramatic"]),
    url: "https://gifdb.com/images/high/ptsd-steve-carell-flashback-kicking-in-meme-uol7cvs5vhz2zvi1.gif",
  }),
  Object.freeze({
    mood: "walking away",
    responseMoods: Object.freeze(["awkward", "funny", "natural"]),
    url: "https://gifdb.com/images/high/lady-chewing-gum-and-walk-away-cv8d5gvf1r7xq1kz.gif",
  }),
]);

export function chooseSofhiaReactionGif(random = Math.random, responseMood = null) {
  if (random() >= SOFHIA_REACTION_GIF_CHANCE) {
    return null;
  }

  const matchingGifs = responseMood
    ? SOFHIA_REACTION_GIFS.filter(({ responseMoods }) =>
        responseMoods.includes(responseMood),
      )
    : SOFHIA_REACTION_GIFS;
  const index = Math.floor(random() * matchingGifs.length);
  return matchingGifs[Math.max(0, Math.min(index, matchingGifs.length - 1))];
}
