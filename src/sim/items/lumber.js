// Lumberjack items (job track J1): the first piece of equipment and the first material. Definitions only.
// Both are character-owned (carried by one character, kept by the Inventory service). Real equip slots do not exist yet, so in J1
// OWNING a tool is what lets you use it (the tool table is sim/jobs/jobs.js, keyed by item id). The Equip action arrives with L3.
// Sim code: no browser, no clock, no randomness (Claude.md 5b). Registered through content/index.js.
import { gramsToMg } from "./weight.js";

export const BASIC_AXE_ID = "basic_axe";
export const VELWOOD_ID = "velwood";

export const LUMBER_ITEMS = [
  {
    id: BASIC_AXE_ID, name: "Basic Axe", category: "equipment", rarity: "common", scope: "character",
    description: "A plain woodcutter's axe. Carry it and press C near a Velthorn to chop. Five good swings fell a tree.",
    maxStack: 1, // one axe; not stackable
    weightMg: gramsToMg(1800),
    actions: [], // equip arrives with L3 (customization and equipment); until then owning it is enough
  },
  {
    id: VELWOOD_ID, name: "Velwood", category: "material", rarity: "common", scope: "character",
    description: "Pale, dense timber from a felled Velthorn. Carried by the character. Good for building and crafting later.",
    maxStack: 999,
    weightMg: gramsToMg(1200), // 1.2 kg a log
    actions: [], // no use, sell or trade yet
  },
];
