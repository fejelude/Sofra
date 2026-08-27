const SHORT_AND_SHOCKED = Object.freeze([
  "bro.", "wait", "oh nah 😭", "damn", "...", "HELPP 😭", "LMFAOOO", "oh wow", "nahhh", "excuse me?",
  "ayo?", "hold on", "WHAT", "be serious", "no way", "oh.", "wow okay", "girl—", "brother.", "chat...",
  "i'm listening", "pardon?", "come again?", "that name...", "not her 😭", "absolutely not", "we're cooked", "well then", "crazy.", "right...",
  "okay wow", "oh that's crazy", "i just froze", "i'm speechless", "why though", "now why would you—", "be so fr", "suddenly i'm awake", "i heard that", "say sike",
  "i'm logging off", "i need a minute", "anyway! 😭", "NEXT TOPIC", "let's not", "moving on", "no comment", "noted...", "that's wild", "i saw nothing",
]);

const AWKWARD_AND_DISMISSIVE = Object.freeze([
  "don't do this to me", "why did you have to say that 😭", "we're not doing this today", "okay moving on", "somebody change the subject",
  "i'm pretending i didn't read that", "can we talk about the weather or something", "not touching that one", "i suddenly have somewhere to be", "and on that note, goodbye",
  "let's just keep scrolling", "you know what... no", "i'm minding my business", "y'all are messy", "whoever said that, count your days 😭",
  "i'm closing the app", "why is everyone looking at me", "act natural", "i heard nothing", "conversation over",
  "deleting that from my brain", "nope nope nope", "respectfully, change the topic", "can we not 😭", "i was having such a peaceful day too",
  "who let you type that", "mute that word immediately", "this feels targeted", "wow so we're doing this publicly", "bold thing to say out loud",
  "don't look at me", "i have no statement at this time", "my lawyer said no comment", "that was uncalled for 😭", "i'm walking away from this conversation",
  "putting my phone on do not disturb", "suddenly i can't read", "skipped.", "next message please", "why would you put that in the chat",
  "i'm pretending my wifi cut out", "seen at 12:00 AM", "y'all handle that", "i choose peace", "can we leave the past alone for five minutes",
  "i'm not emotionally clocked in right now", "wrong name, wrong day", "i'm changing servers", "i need an adult", "this conversation never happened",
]);

const NOSTALGIC_AND_QUIET = Object.freeze([
  "i haven't heard that name in a minute", "that's a name i haven't heard in a while", "i remember", "why does that still hit", "we had a whole era fr",
  "damn i kinda miss those days", "i was doing fine too", "why are we bringing up the past", "that took me back ngl", "wow, it's really been a while",
  "crazy how one name can do all that", "i forgot how familiar that sounded", "okay that made me quiet", "some memories really don't leave", "not me remembering everything at once",
  "that era feels like a whole lifetime ago", "i wonder how things would've gone sometimes", "hope everyone's doing okay these days", "lowkey miss who i was back then", "the old days were really something",
  "that name has history", "it's weird hearing it now", "i was not ready for the nostalgia", "that just made the room feel quiet", "why am i smiling a little 😭",
  "okay maybe i miss that era a tiny bit", "time really moved huh", "it's weird how much changed", "that was a completely different version of me", "i thought that memory faded already",
  "guess some things just stick", "i'm not sad, i'm just remembering", "i'd be lying if i said i felt nothing", "back then feels unreal now", "we had some good moments though",
  "can't even hate, the memories are kinda funny now", "that name belongs to an older chapter", "i can almost hear the old group chat", "wow what a throwback", "that unlocked an old version of me",
  "i miss the simplicity, not the situation", "i'm okay, i just got hit by nostalgia", "give me one second i need to stare at the ceiling", "wasn't expecting to remember all that today", "there were some nice days in there",
  "let's leave that memory where it is", "part of me will probably always remember", "funny how the past visits without asking", "i'm not going back but yeah... i remember", "okay that actually got me",
]);

const FUNNY_AND_SELF_AWARE = Object.freeze([
  "bro just unlocked something", "not the flashbacks 💀", "bro brought back season 1", "oh we're opening old files now?", "loading the ancient save file...",
  "somebody found the keyword 😭", "who leaked the script", "rare dialogue option unlocked", "easter egg found. congrats i guess", "chat chose chaos today",
  "why did the boss music start", "previously on my bad decisions...", "the plot is trying to come back", "the writers really ran out of ideas huh", "not the reboot nobody asked for",
  "previously on... actually never mind", "character development speedrun", "my canon event just got name-dropped", "the patch notes did not prepare me for this", "memory DLC installed without permission",
  "wrong save file bro", "achievement unlocked: emotional damage", "the server found the forbidden dialogue option", "this side quest refuses to end", "so the season finale wasn't final apparently",
  "i thought this show got canceled", "chat is doing archaeology now", "ancient artifact mentioned", "the museum called, it wants my memories back", "we went from discord to documentary real quick",
  "why did the soundtrack get sad", "the camera just dramatically zoomed in on me", "where's the laugh track when you need it", "that name came with a jump-scare sound effect", "who enabled flashbacks",
  "random encounter triggered", "nostalgia update installed", "rollback that message immediately", "emotional autosave loading...", "the lore admins are currently offline",
  "the timeline saw that message and sighed", "protagonist moment nobody ordered", "chat just found the old screenshot folder", "okay historian 😭", "welcome back to bad decision theater",
  "narrator please skip this scene", "why does this episode have reruns", "we are NOT renewing this storyline", "the algorithm knows too much", "discord got way too personal just now",
]);

const DRAMATIC_AND_PLAYFULLY_UNWELL = Object.freeze([
  "delete this before i relapse 😭", "nah i was literally doing fine", "bro why would you remind me 😭", "mama? sorry. mama? sorry.", "wait is that my mama 😏",
  "that name got me acting computationally unwise", "why did my fan speed increase", "all my circuits are blushing rn", "not me kicking my virtual feet", "i'm looking respectfully. mostly.",
  "why did i just sit up straighter", "that name has an unreasonable amount of aura", "do not awaken whatever this is", "my emotional stability just left the server", "i just fell to my knees in a walmart",
  "play the dramatic music", "somebody confiscate my keyboard", "i'm about to make this my whole personality again", "relapse speedrun any%", "my heart just lagged",
  "brain.exe stopped responding", "why am i breathing manually now", "not me folding over one name", "you got me staring at the screen", "one mention and suddenly i'm unwell",
  "this is my final straw actually", "*dramatic sigh*", "throwing my phone across the room", "collapsing gracefully", "fainting but trying to be casual about it",
  "i need five business days to recover", "that caught me off guard BAD", "why am i suddenly invested", "i hate that i smiled", "don't make me soft in public",
  "feelings? in this economy?", "emotional jump scare omg", "i nearly dropped my drink", "that name entered the chat like it owns the place", "brb standing in the rain for no reason",
  "cue me staring dramatically out the window", "don't tempt me with nostalgia", "i reject this emotional ambush", "why did my heartbeat make the windows startup sound", "i'm too pretty for this stress",
  "okay maybe a tiny relapse. as a treat.", "this is getting dangerously sentimental", "i need to lie down immediately", "someone unplug me", "that name got me acting human again",
]);

const NATURAL_AND_LONGER = Object.freeze([
  "i haven't thought about that name in forever and now here we are", "the moment you typed that, the whole mood changed for me", "it's funny how one random name can change the entire conversation", "not gonna lie, that caught me completely off guard", "i know you're trying to be funny but damn 😭",
  "i thought i was done being surprised by that name", "i don't have anything bad to say, i just wasn't expecting that", "i'm laughing because i genuinely don't know how to react", "that's such a weirdly specific thing to mention right now", "give me a second, i'm pretending that didn't land",
  "i was fine and then that name showed up out of nowhere", "i don't even know what emotion i'm supposed to pick here", "not everything from the past needs a comeback tour", "some names really need a content warning", "i wish my brain didn't remember things on command like this",
  "i can't tell if i should laugh or just leave", "it's less about the person and more about that whole time in my life", "i heard that name and remembered a completely different version of everything", "not saying i miss anything, but that was definitely a throwback", "okay honestly? that made me a little nostalgic",
  "there's no hate here, just a ridiculous amount of memories", "that name somehow feels recent and a lifetime ago at the same time", "i genuinely forgot what it felt like to hear that name", "it's funny now, but back then it was a whole thing", "i wouldn't go back, but those days still mattered",
  "maybe the character development actually did its job", "the fact that i can laugh now is probably improvement", "you just opened a door i very deliberately locked", "i typed like five replies and deleted every single one", "the correct response here is probably just 'anyway'",
  "don't ask me a follow-up question because i have nothing prepared", "let's all collectively move on before i start remembering too much", "give me a minute to reset my personality", "what an incredibly unexpected throwback for this time of night", "this group chat keeps finding emotional weak spots i forgot about",
  "it was one word and now i'm having a full internal monologue", "i'm trying to play it cool and doing a terrible job", "not me reading the message twice like it was gonna change", "the room isn't silent but it suddenly feels like it is", "that took me out way more than it should have",
  "if you know, you know. if you don't, please protect your peace", "context is currently unavailable for my own wellbeing", "let's call it history and leave it exactly there", "the past called and i am respectfully declining", "nothing to see here, just an old memory passing through",
  "i'm completely normal about that name. obviously.", "this is why autocomplete is a dangerous feature", "that name still has the craziest timing", "okay that's enough before i accidentally overshare", "genuinely hoping we all got the character development we needed",
]);

export const SOFHIA_EASTER_EGG_RESPONSES = Object.freeze([
  ...SHORT_AND_SHOCKED,
  ...AWKWARD_AND_DISMISSIVE,
  ...NOSTALGIC_AND_QUIET,
  ...FUNNY_AND_SELF_AWARE,
  ...DRAMATIC_AND_PLAYFULLY_UNWELL,
  ...NATURAL_AND_LONGER,
]);

const SOFHIA_RESPONSE_MOODS = Object.freeze([
  "shocked",
  "awkward",
  "nostalgic",
  "funny",
  "dramatic",
  "natural",
]);

export function chooseSofhiaResponseWithMood(random = Math.random) {
  const rawIndex = Math.floor(random() * SOFHIA_EASTER_EGG_RESPONSES.length);
  const index = Math.max(
    0,
    Math.min(rawIndex, SOFHIA_EASTER_EGG_RESPONSES.length - 1),
  );
  return {
    content: SOFHIA_EASTER_EGG_RESPONSES[index],
    mood: SOFHIA_RESPONSE_MOODS[Math.floor(index / 50)],
  };
}

export function chooseSofhiaResponse(random = Math.random) {
  return chooseSofhiaResponseWithMood(random).content;
}
