# BUILD.md: build system and station quality

> Design doc, companion to `FOUNDER.md`. Design intent and extra information, not the absolute truth: where it conflicts with `Claude.md`, the owner resolutions in `FOUNDER.md` section 12, `SERVER_PATH.md` or `docs/proposals/ASSESSMENT.md`, it loses and the conflict is flagged.
> Status: Stage 0 and Stage 1 specified. Stages 2 and 3 deferred. Nothing here is built.
> Last updated: 2026-10-23 (V1.16.0.02)

## 1. Why this exists

- **Solves:** player freedom and emergent content. Players populate the world themselves, so the world grows without the owner hand-authoring every location.
- **Does not solve:** content-authoring cost and testability. Those are solved by data-driven maps (Tiled plus a sprite manifest, `docs/ART_AND_MAPS.md`) and by the dev spawner (section 8). A build system is not a map editor.
- **The fantasy:** "Where I live and how I set it up is my choice, and better setups are better because I invested in them."

## 2. Design laws

1. **Freedom, never requirement.** Building is optional. Whatever a player does at a housed stove they can do worse at a campfire. Stations give **efficiency and quality**, never access. The choice is speed versus quality, never good versus bad.
2. **Tier, don't wall.** Every station tier has a reason to exist: campfire is fast and free; stove is slower to set up with better output; housed stove has the most setup and the best output, with diminishing returns.
3. **Shelter is a check, not a structure.** "Housed" means the station's footprint overlaps a placed Roof footprint. No walls, rooms or flood-fill until Stage 2.
4. **Placement is validated at the boundary.** Placement is a command (like `InputCommand`), validated before it mutates the world: on walkable ground, not overlapping another object, within range of the player. This is `Claude.md` 5b R4 and R11, and keeps the sim server-ready.
5. **Everything placed is saved sim state.** Its own storage key `lycarius.primordia.buildings`, versioned, written through the storage adapter like `Bag` and `Inventory`. Buildings survive reload and are reproducible from a seed plus a command log.
6. **Anti-clutter from day one.** A world full of abandoned campfires is a failed sandbox. Stage 1 ships with a simple cap (section 6), not a decay system.

## 3. The ladder

| Stage | What exists | Needs | Unlocks |
| ----- | ----------- | ----- | ------- |
| **0** | Campfire: placeable, cooks Raw Meat | placement, collision, save | The cooking career |
| **1** | Stove, Roof (shelter) and station tiers | shelter check, tier table | The owner's housing fantasy |
| 2 | Walls, doors, floors, room detection | structure system, pathing | Player-built homes |
| 3 | Ownership, permissions, decay, land claims | multiplayer, accounts | Player towns, shops |

**Build Stages 0 and 1 only.** They are single-player testable, reuse `Entity`, `StatusSystem`, `Lights`, `ParticleSystem`, `ItemRegistry` and the storage adapter, and deliver most of the felt fantasy. In `ROADMAP.md` they are track B.

## 4. Stage 0: Campfire

| Property | Value |
| -------- | ----- |
| Placement | Player action, on walkable ground, no overlap |
| Footprint | Small circle |
| Function | Cooks Raw Meat into Cooked Meat in 2 s (hunger +45, +5% regen for 60 s) |
| Visual | The existing procedural fire and light (client view only) |
| Save | `lycarius.primordia.buildings` |
| Removal | Player action; returns nothing or partial (decision 4, section 10) |

This is the minimum viable build system. With one object it proves the four hard parts: placement, collision, persistence and interaction.

## 5. Stage 1: station quality and shelter

### 5a. Station tiers

The campfire is the baseline. Stations change the cook time and hunger amount and add a **chance** of a random buff on top of the baseline Cooked Meat effect (owner resolution R7).

| Station | Setup | Cook time | Hunger | Buff |
| ------- | ----- | --------- | ------ | ---- |
| Campfire | instant, free | 2.0 s | +45 | baseline +5% regen for 60 s |
| Stove | place + materials | 1.5 s | +50 | baseline, plus 20% chance of a random buff |
| Housed stove | stove under a Roof | 1.2 s | +55 | baseline, plus 60% chance of a higher-tier random buff |

No tier dominates: the campfire wins on speed and cost, the stove on output, the housed stove on quality.

### 5b. Shelter

- A **Roof** is a placed object with a footprint. A station is housed if its footprint overlaps a Roof footprint.
- No walls, room detection or enclosure test. Removing the Roof reverts the station to the outdoor tier at once.
- This one rule is the whole production-buff mechanic. The same check later applies to other stations (a workbench outside versus housed); design them when crafting exists, do not build a workbench now.

### 5c. Random buff

The random buff is drawn from a **seeded bag** (`src/sim/bag/`, M1) fed by `world.rng`, so results are fair, reproducible and server-ready (`Claude.md` 5b R3). The buff list itself is a later design task (`FOUNDER.md` section 11, decision 5).

## 6. Anti-clutter (Stage 1 minimum)

- A player may have at most **N placed objects** (start: 5). Placing beyond N requires removing one.
- Placed objects persist indefinitely in Stage 1 (no decay timer). Stage 3 adds decay and upkeep when multiplayer exists.
- N is a tuning constant, not a design principle: high enough not to feel like a limit, low enough to prevent spam.

## 7. Integration points

| Where | What |
| ----- | ---- |
| `src/entities/` | A `PlacedObject` base (position, footprint, kind, ownerless for now); `Campfire`, `Stove`, `Roof` extend it. Sim only; drawing goes in `src/view/` by `kind` (R5) |
| `src/systems/` | `PlacementSystem` (validate, place, remove as a command) and `ShelterSystem` (footprint overlap, tier lookup), added to the sim group of `pipeline.js` |
| `src/sim/items/` | Recipes reference a station **tier**, not a station entity, so the cooking loop stays station-agnostic |
| `src/content/index.js` | Stations and tiers registered as data |
| Storage | A new adapter key, versioned and serialized like `Bag`; a newer-version save is never overwritten; save and restore are seed-reproducible |

## 8. The dev spawner (1 slot, independent)

A **Developer, Spawner** option in the in-game Settings: click to place any registered entity or item at the mouse position, with no code edit. It fixes "I cannot test everything", needs no save, and reuses the placement validator once Stage 0 exists (until then it uses a minimal validator). It is a small separate roadmap row (B0).

## 9. Not building now

- Walls, doors, floors, rooms (Stage 2).
- Ownership, permissions, sharing (Stage 3).
- Land claims, territory, taxes (Stage 3 and later).
- Decay, upkeep, rent (Stage 3).
- NPC villagers, shops, homes (later).
- Free-form placement with rotation or stacking (later).
- In-place station upgrades (place a new station instead).

## 10. Open decisions (owner)

| # | Decision | Options | Leaning |
| - | -------- | ------- | ------- |
| 1 | Placement grid | free / snap-to-grid | Snap (cheaper, cleaner saves) |
| 2 | Roof shape | rectangle / circle footprint | Rectangle |
| 3 | Placed object limit N | 3 / 5 / 10 | 5 |
| 4 | Removing a station | refunds nothing / partial | Partial (feels fair) |
| 5 | Random buff on stove | yes / no | Yes, 20% (the "reserve food" payoff) |
| 6 | Does hunger drain while the game is closed? | yes / no | No (anti-chore law) |

## 11. Hand-offs

| Step | Prompt (short form) |
| ---- | ------------------- |
| B plan | Read `src/entities/Entity.js`, `src/systems/pipeline.js`, `src/skills/Fireball.js` (data-driven example) and the storage adapter used by `Progression`. Plan Stage 0 and 1: a `PlacedObject` base, a `PlacementSystem` command, a `ShelterSystem`, tiers as data, and a versioned `lycarius.primordia.buildings` save. File layout, pipeline points and the decisions needed. No code |
| B0 spawner | Add Developer, Spawner (section 8). No save. Smallest possible change |
