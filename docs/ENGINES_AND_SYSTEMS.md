# Engines and Systems Guideline (V1.12.0.01)

A phased list of the engines and systems an MMORPG needs, from the first prototype to scale. Source: a Gemini roadmap supplied by the owner, reconciled here with this repository. **It is a guideline, not the truth.** Read one section with `node tools/sec.mjs docs/ENGINES_AND_SYSTEMS.md E2`.

## E0. How to use this file

**When to open it:** any task that creates, plans or reviews a system or an engine (a loop, a transport, a registry, a save layer, a spatial grid, a pipeline). Find the row in E1 to E3, read its `Status` and `Where`, then build only what the owner approved.

**Authority order (higher wins, this file always loses):** `Claude.md` > `SERVER_PATH.md` decisions D1-D13 > `docs/proposals/ASSESSMENT.md` > `docs/MMORPG_GUIDELINE.md` > this file. Where they disagree, follow the higher file and flag the conflict in one line (E4 lists the known ones).

**Not absolute:** the source gives no measurements. The phase order is common practice, not a law. A row can move earlier when it unblocks work (the item data model, for example) and later when it is not needed yet. Verify claims in the repo or with a test before relying on them.

**Status values:** `Built` (exists and tested), `Planned <step>` (has a step in `SERVER_PATH.md` or `ROADMAP.md`), `Not planned` (no step yet: ask the owner before adding one).

**Shape of a row:** Engine or system, what it does, Status, Where it lands in this repo.

**Relation to `docs/MMORPG_GUIDELINE.md`:** that file judges seven ideas (G1-G7) with a verdict. This file is the catalogue: what exists, in which phase. Use both: this one to find the system, that one for the Do / Do not of the topic.

**Status checked at V1.16.0.01:** no server exists. S1a to S1e and S1g are done, S1f is in progress (projectiles and the `Fireball` skill done, `FlameShieldEffect` is next).

## E1. Phase 1: early development (foundations and core simulation)

Goal: a decoupled, deterministic simulation with tests, before any networking.

| System | What it does | Status | Where |
| ------ | ------------ | ------ | ----- |
| Fixed timestep loop | Simulation steps at a fixed rate (30 Hz, D4) independent of the frame rate; rendering interpolates | Planned S1j | `core/Game.js` now runs a variable `dt` capped at 0.05 |
| Sim clock | `world.time` advanced by the sim step; no real-time clock in sim code | Built (V1.12.0.02) | `world.time` in `WorldScene.update` |
| Seeded RNG | Every gameplay roll from one seeded generator (mulberry32) | Built (V1.11.2.01) | `src/sim/rng.js`, `world.rng` |
| Input command layer | Keyboard and mouse become `InputCommand { seq, mx, my, aim, btn }` | Built (V1.12.0.04) | `sim/InputCommand.js`, `input/PlayerController.js`, rule R4 in `Claude.md` |
| Event bus | Combat emits, view and audio subscribe, no direct calls | Built | `core/EventBus.js` |
| Damage out of the view | One sim system applies damage on `hit`; the view only reads events. One ordered system list | Built (V1.12.0.03) | `systems/DamageSystem.js`, `systems/pipeline.js` |
| Entity views | Presentation of an entity (trail, particles, light, drawing) lives in a client-only view found by `entity.kind`; the sim emits plain-data events | Built for the Fireball ball (V1.12.0.05) and the Fireball cast, by skill id (V1.16.0.01); the other groups are planned S1f | `view/EntityViews.js`, `view/SkillViews.js`, `view/FireballView.js`, `view/FireballCastView.js`, `view/index.js` |
| Data registries | Classes, skills and spec bonuses are data | Built (items since V1.13.0.00; status effects: not yet) | `content/index.js`, `core/Registry.js`, `classes/`, `skills/` |
| Universal skill caster | Any entity casts through one interface | Built | `systems/SkillCaster.js` |
| Status system | Burn (damage over time), stun, wards by data offers on hit | Built | `systems/StatusSystem.js`, `skills/BurnWardEffect.js` |
| Stat and modifier engine | Compounding bonuses: element, skill, cooldown, cast time | Built | `progression/SpecBonuses.js`, `Mods.js` |
| Headless tests | Node tests with no DOM pin formulas, cooldowns, RNG | Built (6 files) | `tests/`, `npm test` |
| Audit scripts | Fail when sim code touches DOM, clock or `Math.random` | Built | `tools/audit-server-ready.mjs`, `tools/check-docs.mjs` |
| Ids and plain data | Integer entity ids, replicated fields listed per entity | Planned S1h | rules R8-R9 |
| Sim folder lock | Sim files in `src/sim/`, imported in Node with no stubs | Planned S1k | `tests/import-sim.mjs` |

## E2. Phase 2: mid development (multiplayer and content systems)

Goal: from a single-player sandbox to client and server, plus the world and data models.

| System | What it does | Status | Where |
| ------ | ------------ | ------ | ----- |
| Protocol and validator | Message schemas, size limits, clamped vectors, sanitized strings | Planned S2 | R11 applies to new code from now |
| Loopback transport | In-browser fake network with latency, jitter, loss | Planned S2 | `SERVER_PATH.md` S2 |
| WebSocket server | Real Node server on `ws`, two players | Planned S3 | D3, `ws` approved for S3 only |
| Room manager | One `Simulation` per room, heartbeats, idle cleanup | Planned S3, S6 | D8 |
| Prediction and reconciliation | Local input applied at once, server snapshots correct it | Planned S4 | `SERVER_PATH.md` S4 |
| Entity interpolation | Remote entities rendered slightly in the past | Planned S4 | with S1j render interpolation |
| Item and inventory engine | Item definitions, slots, equipment stats, wallet | L2 built: definitions and `ItemRegistry` (V1.13.0.00), ownership state `Inventory` with its own versioned local save (V1.14.0.00), read-only Home Account Inventory view (V1.15.0.00); character inventory, equipment and rewards planned (inventory proposal phases E to I); M4 (instances) | `sim/items/`; `lobby/Wallet.js` is a placeholder |
| Accounts and database | SQLite, scrypt hashing, sessions, migrations | Planned S5 | D6, D7, `better-sqlite3` approved for S5 only |
| Tilemap and collision grid | Maps and collision as data | Planned T1, T2 | `docs/ART_AND_MAPS.md` |
| Spatial partitioning | Grid for proximity, collision and interest management | Planned W2 | `docs/proposals/World-Division-and-Lag-Management.md`, `src/sim/spatial/` |
| Randomness and loot engine | Marble bag for crit, loot, gates | M1 built (V1.16.0.00): `Bag` primitive and validator in `src/sim/bag/`, not wired in; M2 to M4 planned (owner approves each stage) | `docs/proposals/Marble-bag-engine.md`, `src/sim/bag/` |

## E3. Phase 3: improvement and scaling (optimization, polish, scale)

Goal: measured performance, hardened security, content depth, smoother production.

| System | What it does | Status | Where |
| ------ | ------------ | ------ | ----- |
| Load-test bots | Scripted clients log tick time, memory, bandwidth under load | Planned S6, W5 | `loadtest.mjs` |
| Simulation tiering | Active, reduced and dormant states for far entities and NPCs | Planned W3 | World Division proposal, sections 5 and 6 |
| Rate limiting | Messages and bytes per second per connection, IP caps | Planned S7 | `SERVER_PATH.md` S7 |
| Server as source of truth | Cooldowns, costs, hit detection only on the server | Planned S3 onward | D1; rule R6 keeps the code ready |
| Sprite and asset manifest | Sprites, tiles and animations loaded from data | Planned A1, A2 | `docs/ART_AND_MAPS.md` |
| Desktop wrapper | Thin shell in its own folder, no dependency in the root | Planned S10 (optional, owner approval) | D13, `desktop/` |
| Deployment and backups | Owner's PC first, small VPS later | Planned S8 | D9 |

## E4. Known differences from the source roadmap

| Source says | This repo does | Follow |
| ----------- | -------------- | ------ |
| Validator and rate limits together in the network phase | Validation rules (R11) apply to every new input from now; rate limits wait for S7 | `Claude.md` 5b, S7 |
| Item and inventory engine in the mid phase | The data model has no server need, so L2 may come early | `ROADMAP.md` "Choosing work" |
| Folders `src/net/`, `server/`, `desktop/` | Same names are planned; `desktop/` only after owner approval | `SERVER_PATH.md` 0, S10 |
| 30 Hz example tick | 30 Hz is decision D4 | D4 |
| Spatial grid placed under persistence systems | The grid is a world system (W2) and also serves interest management | W2 |
| Load tests in the last phase | Cheap sim-only load checks can start once S1k is done | G7, S6 |
| No mention of art or maps beyond the sprite pipeline | Art style and map format are decided (D12) | `docs/ART_AND_MAPS.md` |

## E5. Checklist before creating a system or engine

1. Find the row in E1-E3. No row: say so and ask the owner, do not invent a phase.
2. Check its `Needs` in `ROADMAP.md` "Choosing work" and `SERVER_PATH.md` section 0. Do not start a row whose predecessor is not green.
3. Read the matching `G<n>` in `docs/MMORPG_GUIDELINE.md` and, for random, loot, zones or load, `docs/proposals/ASSESSMENT.md` section 1 first.
4. Build one step per version. New sim files get zero audit hits and a headless test.
5. Update this file's `Status` and `Where` in the same version, and the code map in `Claude.md`.
6. If the guideline and the repo disagree, follow the repo and add a line to E4.
