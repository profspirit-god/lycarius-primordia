# Roadmap

Current version: **V1.12.0.04**. Completed work is recorded in `CHANGELOG.md`; this file lists what is planned. Order is a guide, not a promise, and each step ships as its own version.

## Choosing work (read this when the user does not know what to work on)

Procedure for any Claude session: (1) read this section, (2) check the `Needs` of the candidate in its table below, (3) recommend one item and name two alternatives, (4) before building, read the matching section of `docs/MMORPG_GUIDELINE.md` (`node tools/sec.mjs docs/MMORPG_GUIDELINE.md G2`). The guideline is **a guide, not the truth**: its evidence is unmeasured, and the authority order is `Claude.md` > `SERVER_PATH.md` decisions > `ASSESSMENT.md` > guideline. Keep this table current: when a step ships, update its row.

| Candidate | Needs | Guideline | Why pick it |
| --------- | ----- | --------- | ----------- |
| **S1f Presentation out of the sim** (`SERVER_PATH.md` S1f) | S1d (done in V1.12.0.03) | G3, G5 | **Default.** Critical path: the next server step, one group per version (projectiles first). The sim part emits plain-data events; drawing and particles move to listeners. Large: split it, and start with `FireballProjectile` |
| S1g Storage adapter (`SERVER_PATH.md` S1g) | S1a (done in V1.10.0.05) | G4 | Small and independent: `Progression` gets a `storage` object, then `tests/mage.test.mjs` loses its `localStorage` stub |
| L2 Items and inventory data model | none | G1, G5 | No server dependency; unlocks L3, L4, L5 and M4 |
| M1 Pure bag primitive in `src/sim/bag/` | none (new files, not wired in) | G1 | May ship before S1 closes; owner approves the stage |
| A1 / T1 art and map groundwork | S1f for A1, A2 for T1 | G3 | Art production can start now (sizes fixed) |
| Combat depth items (section "Next: combat depth") | none; follow `Claude.md` 5b | G5 | Content work that never blocks S1 |

Default when the user says "you decide": **S1f** (first group: projectiles). Never start an item whose `Needs` are not green, and never more than one step per version.

## Done

| Version  | Content                                                                 |
| -------- | ----------------------------------------------------------------------- |
| V1.0.0.00 | MVP: menu, settings, Mage, Fireball, training dummy, effect stack      |
| V1.1.0.00 | Vitals (health, mana), mana-cost Fireball, hostile dummy               |
| V1.2.0.00 | Procedural audio engine and positional sound                           |
| V1.2.0.01 | Cleanup: shared helpers, JSDoc contracts                               |
| V1.3.0.00 | Moving dummy: Stationary, Patrol and Strafe modes                      |
| V1.4.0.00 | Magic circle casting, Flame Shield (toggle skill with shield points)   |
| V1.5.0.00 | Burn status effect, Burn Resistance (cast-time self buff, nullify toast) |
| V1.6.0.00 | Experience, class specialization tree, projectile clash and explosions, dummy uses skills, Campaign / Training Ground / Live Server menu, cast-timer debug, dev XP panel |
| V1.7.0.00 | Lobby menus: title menu (Play / Creator Support / Exit), Home scene, Shop, Mode Select, Training loading screen. All placeholders |
| V1.8.0.00 | Lobby art: Home scenery, Mode Select video, mode card pictures, training loading art (L1 partly done) |
| V1.9.0.00 | Graugr melee enemy (smart AI, 3 skills), stun status, projectile deflect, mock raid with enhancement tiers, kill and one-shot counters |
| V1.10.0.00 | Real task-based loading screen, stamina resource, DOM HUD (profile circle, compact bars, status effects, skill circles), character panel, SVG icon set |
| V1.10.0.01 | Docs and tooling (no gameplay change): `SERVER_PATH.md` (road to online, home-PC hosting, exe build), server-ready rules in `Claude.md`, `tools/audit-server-ready.mjs`, `tests/graugr.test.mjs`. This is the V1.9.0.01 package, applied on top of V1.10.0.00 |
| V1.10.0.02 | Docs and tooling (no gameplay change): two design proposals kept in `docs/proposals/` with a feasibility assessment, roadmap tracks M and W, `tools/sec.mjs` section reader, doc map in `Claude.md`. S1 sub-steps now start at V1.10.0.03 |
| V1.10.0.03 | Docs only (no gameplay change): art style decided (semi-pixelated), `docs/ART_AND_MAPS.md` with art intake track A and tile/map track T (Tiled), D12 updated |
| V1.10.0.04 | Docs and tooling (no gameplay change): `docs/MMORPG_GUIDELINE.md` (Gemini seven-part sequence reconciled with this repo, guide not truth), roadmap "Choosing work", `Claude.md` rules 10 and 11, `tools/check-docs.mjs`. S1 sub-step versions now start at V1.10.0.05 |
| V1.10.0.05 | Tests only (no gameplay change): **S1a safety net**, `tests/mage.test.mjs` (52 tests) and `tests/helpers.mjs` pin Fireball, cooldowns and mana, burn, Flame Shield, explosions, clashes, XP and levels; `npm test` runs both files. S1 sub-step versions now start at V1.10.0.06 |
| V1.11.0.00 | Fire Blast: fourth Mage skill (`R`, hold; 70 damage AOE, knockback, 40% burn, 40 mana, 60 s cooldown), unlocks at specialization level 8; `SkillDef.noAi`, `blast` event, `tests/fireblast.test.mjs`. S1 sub-steps now start at V1.11.0.01, S1 closes at V1.12.0.00 |
| V1.11.1.00 | Fix: Fire Blast froze the game on `R` (a self skill without a `palette` crashed `Player.draw`); fallback palette, draw and full-cast regression tests (15) |
| V1.11.2.00 | Mana Regen (Mage passive, `F`, x5 mana regen for 30 s, 3 min cooldown), Dodge (universal, `Shift`, 20 stamina, 25 s), `instant` skill type, yellow dodge trail, blue regen glow |
| V1.11.2.01 | Cleanup (no gameplay change): **S1b seeded RNG**, `src/sim/rng.js` (mulberry32) and `world.rng`; every gameplay roll moved off `Math.random`, visual randomness stays; `tests/rng.test.mjs` (10 tests: same-seed Fireball lists, three scripted fights, `Math.random` independence); audit `random` debt 160 to 139 |
| V1.12.0.00 | Fix: Home modal X. Feature: buff visual language (circles = regen, ribbons = resistance, dashes = motion), sectioned Settings (`ui/SettingsPanel.js`) with fixed Reset / Save / Back footer and unsaved-changes prompt; dummy and developer options moved to the in-game Settings. |
| V1.12.0.01 | Docs: `docs/ENGINES_AND_SYSTEMS.md`, a phased catalogue of engines and systems (early, mid, scale) with repo status; referenced from `Claude.md` rule 11 and the doc map. Guideline, not truth. |
| V1.12.0.04 | Cleanup (no gameplay change): **S1e input command layer**, `InputCommand { seq, mx, my, aim, btn }` validated in `sim/InputCommand.js`; client-only `input/PlayerController.js`; `Player` reads only `this.cmd`; `tests/input.test.mjs` (8 tests); audit `input` debt 6 to 0 |
| V1.12.0.03 | Cleanup (no gameplay change): **S1d damage out of the view**, new `DamageSystem` applies every `hit` through `target.onHit`; `HitEffects` and `BurnFx` are visuals only and set `flash` and `glow`; `onHit` / `onDot` of Player, Graugr and TrainingDummy are sim only; `systems/pipeline.js` is the one ordered list of systems; `tests/damage.test.mjs` (9 tests); audit debt unchanged. M2 is now unblocked (S1b and S1d done) |
| V1.12.0.02 | Cleanup (no gameplay change): **S1c sim clock**, `world.time` advanced per sim step, the dummy's DPS readout moved off `performance.now`; `onHit` / `onDot` receive the world; `tests/clock.test.mjs` (4 tests); audit `clock` debt 6 to 3 (the rest is draw code) |

## Server path (road to online)

The full contract is **[SERVER_PATH.md](SERVER_PATH.md)**: architecture decisions, an audit of today's code, ten phases with exact steps and "done when" tests, hosting, costs, security and legal flags. Summary:

| Phase | Version | Goal | Sessions (rough) |
| ----- | ------- | ---- | ---------------- |
| S1 | V1.10.0.03 to V1.10.0.xx, closing **V1.12.0.00** (Fire Blast took V1.11.0.00 in between) | Separate simulation from view; seeded RNG, damage and input out of the view, many players, fixed timestep. Behaviour unchanged | 14 to 20 |
| S2 | V1.12.0.00 | Message protocol and a loopback "network" with fake latency inside one browser | 3 to 5 |
| S3 | V1.13.0.00 | Real Node WebSocket server, two players in one room, garbage-input test, server address setting | 3 to 5 |
| S4 | V1.14.0.00 | Client prediction and smoothing | 3 to 5 |
| S5 | V1.15.0.00 | Accounts (username + password) and SQLite saving | 3 to 5 |
| S6 | V1.16.0.00 | Rooms, co-op raid by invite code, interest management, **50-bot load test** | 3 to 5 |
| S7 | V1.17.0.00 | Security hardening | 2 to 3 |
| S8 | V1.18.0.00 | Deployment: **S8a on the owner's own PC** (default, through an outbound tunnel), S8b on a small VPS when a trigger fires; backups, rollback | 2 to 4 |
| S9 | V1.19.0.00, then **V2.0.0.00** | Closed alpha with friends, then a 50-player scale test | 2 weeks of testing |
| S10 | next free minor (optional, any time after S3) | **Desktop build (exe)**: Electron wrapper in its own `desktop/` folder, real Exit Game | 2 to 3 |

Gates for every step: `node tests/graugr.test.mjs`, `node tests/mage.test.mjs` (or `npm test`), `node tools/audit-server-ready.mjs` (debt may never go up), manual play check, docs updated. Feature work in other areas may continue in between, but must follow the server-ready rules (`Claude.md` 5b). Art style is decided (semi-pixelated, D12) and does not block any phase.

**Hosting decision (owner, V1.10.0.01):** run the 10 to 50 player server on the owner's own PC to save rent. Assessed as feasible with conditions (the CPU tick budget is the real limit, not the PC; upload is about 8 to 24 Mbps at 50 players; use an outbound tunnel, never open router ports; a 100 W desktop on 24/7 costs about as much electricity as a small VPS). Details and the triggers for moving to a VPS are in `SERVER_PATH.md` S8a.

**Exe packaging (answer, V1.10.0.01):** yes. Recommended path is Electron in `desktop/` (S10); a Tauri build is smaller but needs a Rust toolchain; an installed web app (PWA) is a zero-dependency stopgap. Needs owner approval before any dependency is added. See `SERVER_PATH.md` S10.

## Proposals (assessed in V1.10.0.02, not built)

Sources and full analysis: `docs/proposals/` (`ASSESSMENT.md` sections 1 to 8). Both are **feasible in stages**; neither needs a dependency. Each stage is its own version, needs owner approval, and starts only when its prerequisites are green. Open the proposal sections with `node tools/sec.mjs`.

**Marble Bag Engine (M)**: controlled randomness (bags of outcome tokens), gates, nested bags, persistent hidden item-instance secrets.

| Stage | Work | Needs |
| ----- | ---- | ----- |
| M1 | Pure bag primitive + validator + seeded-RNG tests in `src/sim/bag/` (new files, not wired in). May ship before S1 closes | none |
| M2 | Fireball crit drawn from a per-caster bag (rate decision pending: default keeps 12%) | S1b, S1d |
| M3 | Gates (`ALL/ANY/NOT`, counts, bounded sequences) | M1, S1h |
| M4 | Item-instance secrets, one-time effects, first data-driven item (masterwork bow) | L2, S1h, S5 |
| M5 | Crafting gates, NPC memory, world mysteries, discovery archive | M4, NPCs, accounts |

**World Division and Lag Management (W)**: zones, instances, spatial cells, interest management, tiered NPC simulation. The 100 players + 400 NPCs figure is a design ceiling only; the committed targets stay 10 to 50 players (S6, S9) until measured.

| Stage | Work | Needs |
| ----- | ---- | ----- |
| W1 | Design note for this codebase (zone, room, cell shapes, tick budget, overload policy) written into `SERVER_PATH.md` | S1k |
| W2 | Spatial grid in `src/sim/spatial/`; used by S6 interest management (hysteresis, snapshot on enter, deltas after) | S1h, S2 |
| W3 | Active / reduced / dormant tiers for a small NPC set, elapsed-time catch-up | NPC type, S1c, S5 |
| W4 | Zone copies, private instances, capacity limits, cleanup | S6, zones |
| W5 | Automated load tests and tuning, limits recorded | S6 `loadtest.mjs` |

Hooks into the server path (which S1/S2/S5/S6 step must expose what): `SERVER_PATH.md` section 8.

## Lobby path (for the next sessions)

The lobby shell exists with placeholder data. Everything below plugs into it without restructuring. Scenes: `menu` → `home` → `modes` → (`loading` →) `world` / `campaign` / `live`; `home` → `settings`. Scenes talk only through `game.goto(name, params)`. Placeholder content lives in `src/lobby/lobbyData.js`; shared helpers are `lobby/Wallet.js` and `ui/Modal.js`.

| Step | Work | Where it plugs in | Depends on |
| ---- | ---- | ----------------- | ---------- |
| L1 | **Partly done in V1.8.0.00** (scenery, Mode Select video, card pictures, training loading art; lazy loader `lobby/assets.js` with placeholder fallback). Still to do: Home character art (replace the cylinder), shop item images, profile avatar, per-mode videos, loading art for Campaign and Live | `HomeScene.render`, `Shop` cards, `ART` / `MODES[].pic` / `LOADING[].image` in `lobbyData.js` | Art from the user |
| L2 | Items and inventory data model: items as definitions in a `Registry` (`ItemRegistry`), registered in `content/index.js`; versioned save | Inventory button (placeholder modal in `HomeScene.openPlaceholder`) | None |
| L3 | Character customization: pick outfit / aura / skill effect and apply it in `Player.draw` / `drawCylinder` tint and `drawAura` | Character button; Shop cosmetics | L2 |
| L4 | Wallet persistence and the Shop buy flow (`Wallet.spend`, ownership check, versioned save), then server-side checks | `Wallet.js`, `HomeScene.openShop` (`data-a="buy"`) | L2 |
| L5 | Genesis Path: reward track data (free and premium lanes), XP source (play time / quests), claim UI. Subscription price and model are the user's decision | `GENESIS_PATH`, `HomeScene.openGenesis` | L2, L4 |
| L6 | Season Info and Rank: season calendar, ranked ladder and tiers | Bottom row placeholders | Rank needs V2.0.0.00 (server) |
| L7 | Messages inbox: subscribe the bell to events (system, creator, events); unread dot | `HomeScene.openMessages`, `MESSAGES` | EventBus |
| L8 | Profile and login (Google sign-in), friends, guild | Profile circle, `PROFILE` | V2.0.0.00 |
| L9 | Creator Support: real support links / provider and an idea form or community link. Ask the user which provider | `CreatorSupportScene` | User decision |
| L10 | **Partly done in V1.10.0.00** (task-driven loading bar, readiness gate, fatal error screen). Still to do: dynamic `import()` of zone / class data as a task, and `LOADING` entries for Campaign and Live | `LoadingScene`, `lobby/loadTasks.js` | World work (tilemap, zones) |
| L11 | Live Server and Campaign replace their `PlaceholderScene`s; Mode Select stats (players, ping, progress) come from real data | `MODES` in `lobbyData.js` | V2.0.0.00 / Campaign work |

Rules for this area: keep content as data in `lobbyData.js` (or registries once real); no direct imports between scenes; reuse `openModal`; keep the cosmetic-only shop rule (no gameplay power for sale) unless the user decides otherwise; one lobby feature per version.

## Next: combat depth (continued)

- Sprites and animation for characters (replace the plain cylinders; keep the pseudo-3D `(x, y, z)` model).
- Dummy behaviours beyond movement: dodging, retreating at low health (Graugr has both since V1.9.0.00; the dummy does not).
- Graugr follow-ups: its own sounds (swing, poke charge, leap), a stagger rule for the Poke charge, a basic arm punch between long cooldowns, tuning once played (Barrage damage is very high against 50 HP).
- Raid follow-ups: rewards per raid, more enemy types, a best-raid record, a Settings or Developer-options row to jump to a raid number.
- Stun for the player's own skills; other stun sources.
- More status effects on the new `StatusSystem` (any skill can offer one through the `burn` field on its `hit` event).
- Skill hotkey rebinding and a Settings row for it.
- Make character level matter (stat growth per level) and add a respec option for the specialization tree.
- Second class and a second specialization element; explosions that can ignite; clash rules for other projectile types.

## Art and maps (V1.10.0.03, plan only)

Style: **semi-pixelated** (pixel-art sprites and tiles, smooth effects); 32 px tiles, 32x48 px characters, integer scale 2 or 3. Details, rules and map format: `docs/ART_AND_MAPS.md`. Maps are made in **Tiled** (no custom editor); art enters through a data manifest (no per-asset code).

| Stage | Work | Needs |
| ----- | ---- | ----- |
| A1 | Sprite manifest, loader, `drawSprite`, cylinder fallback | S1f |
| A2 | `PIXEL_SCALE` camera + Settings row, pixel rules | A1 |
| A3 | Animation state from sim data (idle, walk, cast, hurt, dead) | A1, S1h |
| A4 | Effect/status art (optional) | A1 |
| T1 | Tiled JSON loader + validator, placeholder tileset, tile render layer | A2 |
| T2 | Collision grid in the sim (server-ready) | T1, S1h |
| T3 | Objects layer: spawn points, exits, NPC points | T2 |
| T4 | Two zones, transitions, lazy zone loading | T3, L10 |
| T5 | Dev overlay: collision, spawns, grid cells | T2 |

Art production can start now (sizes are fixed); nothing in A or T blocks S1.

## Then: world

- Tilemap and collision replacing the infinite placeholder ground: track T above.
- Two zones and zone transitions; lazy-load zone data with dynamic `import()`: T4.

## Later

1. More classes and skills; cooldowns and a skill bar.
2. Progression (levels and specialization exist; still to do): stats, items, inventory.
2b. **Campaign** (single-player story) and **Live Server** (online open world) replace the menu placeholders.
3. NPCs, dialogue, quests and branching story.
4. Enemies and bosses with reusable AI built on `SkillCaster`.
5. Desktop wrapper (real "Exit Game"): planned as phase S10 in `SERVER_PATH.md` (Electron in `desktop/`).
6. **V2.0.0.00**: server-authoritative multiplayer, parties and co-op missions (see the Server path above).
7. Factions, guilds, guild wars and territory wars.
8. **Proto**: the refined second edition, as a separate repository.
