// verb-adjective-noun guest token generator
// ~150 verbs × ~150 adjectives × ~150 nouns = ~3.4 million combinations
// All words are short, common, and easy to type on mobile

const VERBS = [
  "dance", "shake", "glow", "drift", "hum", "spin", "float", "burn", "jump",
  "slide", "wave", "flip", "blast", "crush", "drop", "fade", "flow", "grab",
  "haul", "ignite", "kick", "launch", "lift", "loop", "march", "mix", "move",
  "nudge", "paint", "play", "plug", "pop", "pour", "pull", "push", "ride",
  "ring", "rise", "rock", "roll", "run", "rush", "sail", "send", "shift",
  "sing", "slam", "snap", "soar", "spark", "sprint", "stomp", "stride",
  "strike", "surf", "sway", "swing", "toss", "twist", "vault", "vibe",
  "walk", "zoom", "beam", "bend", "blaze", "bolt", "boost", "bounce",
  "brew", "burst", "catch", "chase", "churn", "clap", "clash", "click",
  "climb", "coast", "crank", "crawl", "cruise", "curl", "cut", "dash",
  "dig", "dive", "draw", "drive", "drum", "dunk", "echo", "feel", "fire",
  "fish", "fly", "fold", "forge", "fuel", "grind", "groove", "grow", "guide",
  "hit", "hold", "hype", "jam", "jolt", "jump", "land", "lead", "leap",
  "loft", "loop", "lure", "mash", "melt", "pace", "peak", "pitch", "pivot",
  "pound", "press", "pump", "reach", "read", "reel", "rev", "roam", "roar",
];

const ADJECTIVES = [
  "golden", "quiet", "wild", "bright", "dark", "swift", "bold", "calm",
  "deep", "fierce", "free", "grand", "heavy", "icy", "jade", "keen",
  "lazy", "loud", "mad", "neon", "noble", "odd", "pale", "proud", "raw",
  "red", "rich", "round", "royal", "rusty", "sharp", "shiny", "short",
  "shy", "silk", "slim", "slow", "small", "smart", "smoky", "soft",
  "solar", "solid", "sonic", "sour", "spicy", "stark", "steel", "still",
  "stone", "stormy", "sugar", "sunny", "super", "sweet", "swift", "tall",
  "tame", "tangy", "tiny", "tough", "true", "ultra", "urban", "vast",
  "velvet", "vivid", "warm", "wavy", "white", "windy", "wise", "witty",
  "woody", "young", "zesty", "amber", "azure", "basic", "black", "blank",
  "blaze", "blue", "brave", "breezy", "bronze", "bubbly", "busy", "clean",
  "clear", "clever", "cloudy", "cozy", "crisp", "cubic", "curly", "cyan",
  "damp", "daring", "dizzy", "dusty", "earthy", "edgy", "elastic", "elegant",
  "emerald", "empty", "epic", "eternal", "even", "exact", "exotic", "fancy",
  "fast", "faint", "fizzy", "flaky", "flashy", "flat", "fluffy", "foggy",
  "funky", "fuzzy", "giant", "glossy", "glowing", "goofy", "gritty", "groovy",
  "hazy", "hollow", "honey", "humble", "hungry", "hyper", "iconic", "indie",
  "inner", "iron", "jazzy", "jolly", "juicy", "jumpy", "kinetic", "lemon",
];

const NOUNS = [
  "panda", "storm", "flame", "wave", "river", "tiger", "comet", "drift",
  "echo", "frost", "grove", "hawk", "isle", "jazz", "kite", "lava",
  "mist", "nova", "orbit", "peak", "quartz", "reef", "sage", "tide",
  "ultra", "vapor", "wind", "xenon", "yak", "zeal", "anchor", "beam",
  "blaze", "bloom", "bolt", "breach", "bridge", "brook", "canyon", "cape",
  "cedar", "chain", "chord", "cloud", "coast", "core", "crest", "crown",
  "crush", "current", "curve", "cycle", "delta", "depth", "dune", "dust",
  "ember", "epoch", "field", "flash", "flint", "floe", "flume", "foam",
  "force", "forge", "forum", "fuse", "gale", "gate", "geyser", "glacier",
  "glow", "grain", "granite", "grid", "grove", "gulf", "haze", "heat",
  "hill", "horizon", "hound", "hull", "hum", "hype", "inlet", "iris",
  "iron", "island", "jaguar", "jungle", "kelp", "lagoon", "lance", "laser",
  "leaf", "ledge", "lens", "light", "lime", "lion", "loop", "lunar",
  "marsh", "mesa", "meteor", "mint", "moon", "moss", "mountain", "nebula",
  "night", "node", "oak", "ocean", "onyx", "opal", "orca", "palm",
  "path", "pine", "pixel", "plasma", "plume", "pond", "pool", "prism",
  "pulse", "quake", "rail", "rain", "raven", "ray", "ridge", "ring",
  "rock", "root", "rose", "rush", "sand", "shore", "signal", "sky",
  "slate", "smoke", "snow", "solar", "spark", "sphere", "spike", "spine",
];

export function makeGuestToken() {
  const verb = VERBS[Math.floor(Math.random() * VERBS.length)];
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${verb}-${adj}-${noun}`;
}
