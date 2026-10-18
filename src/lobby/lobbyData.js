// Placeholder data for the lobby (Home, Mode Select, Shop...). Replace with real data / server calls later.
// Keep it plain data: scenes only render it, so real content slots in without touching scene code.

/** Placeholder account. Real login (Google sign-in) arrives with the online work (V2.0.0.00). */
export const PROFILE = {
  name: "Wanderer",
  email: "player@gmail.com",
  id: "LYC-000001",
  title: "Placeholder title",
  level: 1,
  fields: [
    ["Account", "Not linked (placeholder)"],
    ["Region", "Placeholder"],
    ["Joined", "Placeholder"],
    ["Friends", "0"],
    ["Guild", "None"],
    ["Playtime", "Placeholder"],
  ],
};

/** Shared wallet. Home and Shop read the same object, so the balance carries into the shop. */
export const WALLET = {
  currencies: [
    { id: "gold", label: "Gold", icon: "◉", color: "#f2c46d", amount: 12500, hint: "Earned in play. Buys common cosmetics." },
    { id: "crystals", label: "Crystals", icon: "◆", color: "#7fd4ff", amount: 320, hint: "Premium currency. Placeholder." },
    { id: "points", label: "Points", icon: "✦", color: "#c9a2ff", amount: 90, hint: "Event / Genesis Path points. Placeholder." },
  ],
};

export const SHOP = {
  tabs: [
    { id: "featured", label: "Featured" },
    { id: "outfits", label: "Outfits" },
    { id: "auras", label: "Auras" },
    { id: "effects", label: "Skill Effects" },
    { id: "emotes", label: "Emotes" },
  ],
  items: [
    { name: "Ember Robe", tab: "outfits", price: 800, cur: "gold", rarity: "rare" },
    { name: "Ashen Cloak", tab: "outfits", price: 1200, cur: "gold", rarity: "rare" },
    { name: "Primordial Garb", tab: "outfits", price: 280, cur: "crystals", rarity: "epic" },
    { name: "Cinder Halo", tab: "auras", price: 600, cur: "gold", rarity: "common" },
    { name: "Molten Veil", tab: "auras", price: 150, cur: "crystals", rarity: "epic" },
    { name: "Blue Flame Fireball", tab: "effects", price: 90, cur: "crystals", rarity: "epic" },
    { name: "Spark Trail", tab: "effects", price: 400, cur: "gold", rarity: "common" },
    { name: "Bow of Respect", tab: "emotes", price: 250, cur: "gold", rarity: "common" },
    { name: "Fire Dance", tab: "emotes", price: 60, cur: "points", rarity: "rare" },
  ],
};

export const GENESIS_PATH = {
  name: "Genesis Path",
  blurb: "Season pass",
  tier: 0,
  tiers: 50,
  // Subscription / battle-pass design is open. See ROADMAP.md.
};

/** Bottom row of the Home scene. `scene` set = navigates; otherwise opens a placeholder modal. */
export const HOME_BUTTONS = [
  { id: "inventory", label: "Inventory", icon: "▣", blurb: "Items, materials and equipment." },
  { id: "customize", label: "Character", icon: "☉", blurb: "Character customization: look, outfit, aura." },
  { id: "season", label: "Season Info", icon: "❖", blurb: "Current season, rewards and timeline." },
  { id: "rank", label: "Rank", icon: "♛", blurb: "Ranked ladder, tiers and leaderboards." },
  { id: "settings", label: "Settings", icon: "⚙", scene: "settings" },
];

export const MESSAGES = [
  { from: "System", text: "Welcome to Lycarius: Primordia. (placeholder message)", time: "now" },
  { from: "Creator", text: "Thanks for testing. Feedback welcome. (placeholder)", time: "today" },
  { from: "Events", text: "Season announcements will appear here. (placeholder)", time: "soon" },
];

/** The three entries of the mode select. `scene` is where Play leads. Training goes through the loading screen. */
export const MODES = [
  {
    id: "live",
    name: "Live Server",
    tag: "Online · MMORPG",
    color: [120, 190, 255],
    blurb: "The persistent open world, played online with other players. Factions, guilds and territory wars arrive here.",
    stats: [
      ["Server", "Primordia-01 (placeholder)"],
      ["Status", "Offline (needs V2.0.0.00)"],
      ["Starting point", "Placeholder hub"],
      ["Players online", "0 / 0"],
      ["Ping", "-- ms"],
      ["Region", "Placeholder"],
    ],
    go: { scene: "live" },
  },
  {
    id: "campaign",
    name: "Campaign",
    tag: "Single player · Story",
    color: [255, 200, 110],
    blurb: "The branching single-player story: quests, NPCs and choices that shape the world.",
    stats: [
      ["Chapter", "Prologue (placeholder)"],
      ["Starting point", "Placeholder village"],
      ["Progress", "0%"],
      ["Party", "Solo (co-op later)"],
      ["Difficulty", "Placeholder"],
      ["Status", "Not built yet"],
    ],
    go: { scene: "campaign" },
  },
  {
    id: "training",
    name: "Training Grounds",
    tag: "Sandbox · Playable now",
    color: [255, 130, 70],
    blurb: "Combat sandbox with a training dummy. Test skills, the specialization tree and Settings dummy options.",
    stats: [
      ["Starting point", "Training field"],
      ["Current players", "1 (you)"],
      ["Class", "Mage"],
      ["Dummy", "Set in Settings"],
      ["Progress saved", "Yes (this browser)"],
      ["Status", "Playable"],
    ],
    go: { scene: "loading", params: { target: "training" } },
  },
];

/** Loading screens. Add one entry per destination; LoadingScene reads it by `target`. */
export const LOADING = {
  training: {
    title: "TRAINING GROUNDS",
    subtitle: "Preparing the field",
    tips: [
      "Hold the fire button longer: a bigger charge hits harder and costs more mana.",
      "Two enemy fireballs that meet explode and hurt everyone nearby, including you.",
      "Press K for the specialization tree. Pending picks pulse green.",
      "Flame Shield absorbs damage, but explosions go through it.",
      "Burn Resistance halves burn damage and can snuff a burn outright.",
    ],
    minTime: 2.4,
    next: { scene: "world", params: { classId: "mage", mode: "training" } },
    art: "Placeholder: custom training art / video goes here",
  },
};
