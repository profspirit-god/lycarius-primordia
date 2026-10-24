# Changelog

Format: `V<MAJOR>.<MINOR>.<FIX>.<CLEANUP>` (see README → Versioning). Newest first.

## V1.17.0.00 — H1: the pure hunger primitive (feature, new files only, nothing user-visible)

First step of track H (`ROADMAP.md`, design in `FOUNDER.md` section 6): the keystone of the gather, cook, eat, fight milestone. A hunger stat that falls with sim time and is raised by eating, with five tiers as data. It is **not wired into the game**: nothing creates a `Hunger` until H2, so there is no change to play.

### Added

- **`src/sim/hunger/Hunger.js`**: `Hunger` (`value`, `tier`, `tierId`, `canEat`, `regenMult`, `moveMult`, `staminaRegenMult`, `status`). `update(dt)` drains `dt / drainSeconds` and floors at 0, returning `{ from, to }` when a tier changed (plain data for a later event) or null; a bad `dt` is ignored. `eat(amount)` adds up to `max` and returns `{ ok, gained, value, change }`, or `cannot_eat` (Stuffed refuses) or `invalid_amount`; a refused call changes nothing. `serialize()` and `Hunger.restore(def, raw)` give a versioned plain save (`corrupt`, `newer_version`, `mismatch` are refused with a reason and nothing is created). `tierFor(def, value)` is the pure lookup. All state is `#private`.
- **`src/sim/hunger/validateHunger.js`**: `validateHungerDef` / `normalizeHungerDef`. The hunger-law guardrails are limits here, so no tier table can break them: a tier has no damage field, `moveMult` is at least 0.9 (never more than -10% speed), regen multipliers are at least 0.1 (never off), one tier starts at 0 and the lowest tier can eat (food is never a soft-lock). Tiers are sorted high to low whatever order the content lists them.
- **`src/sim/hunger/definition.js`**: `PRIMORDIA_HUNGER`, the tuning as data: max 100, 1 point per 90 s, tiers Stuffed 90, Full 60, Not hungry 25, Hungry 8, Starving 0 with the multipliers of `FOUNDER.md` section 6. All numbers live in this file only.
- **`tests/hunger.test.mjs`** (24 tests): the tier table, the validator and its guardrails, exact tier edges, the drain math (100 to 0 in 9000 s), tier-change reports, frame-rate independence (60, 30 and 1 steps per second), eating (cap, Stuffed refuses, bad amounts), a save round trip through the storage adapter contract, every refused save shape, a Node child-process import with no globals, and a source scan.

### Changed

- `npm test` runs seventeen files. `VERSION` 1.16.0.02 to 1.17.0.00. README (Hunger row), ROADMAP (H1 done, default now H2), `Claude.md` (rule 3 test list, code map), `docs/ENGINES_AND_SYSTEMS.md` (new row), `FOUNDER.md` (R11, decision 6, session log).

### Notes

- **Default taken, flagged (R11):** `start` is **85 (Full)**, not the 100 of the first draft. At 100 a new character would begin Stuffed (cannot eat, -10% move speed) for its first 15 minutes. One number in `definition.js`.
- **Flagged for tuning (`FOUNDER.md` section 11, decision 6):** one Cooked Meat (+45) eaten at 55 or more reaches Stuffed, and Stuffed costs -10% move speed until the value falls under 90 (up to 15 min). Raw Meat (+15) only reaches it from 75. This may feel like a chore; decide in the tuning doc once H2 is playable.
- **Server-ready:** yes. Zero audit hits in the new files; totals unchanged (`random` 93, `present` 198). No rng is used: hunger is deterministic. The caller must pass only sim `dt`, so hunger never drains while the game is closed (the "no offline drain" leaning).
- Not tested: playing in a browser (nothing is wired in). The tests are the proof.

## V1.16.0.02 — FOUNDER.md and BUILD.md: design intent reconciled with the roadmap (docs only, no gameplay change)

Two design docs written as first drafts by DeepSeek were reviewed against the repo (V1.16.0.01) and the owner's decisions. They are kept as **design intent and extra information, not the truth**; each conflict was resolved so that no existing plan is hindered.

### Added

- **`FOUNDER.md`**: design laws, working rhythm, primitives order, death law, hunger law and spec (five tiers, Stuffed included), food economy, anti-drift list, current milestone (gather, cook, eat, fight better), open decisions, and section 12 with owner resolutions R1 to R10.
- **`BUILD.md`**: build system Stage 0 (campfire) and Stage 1 (stove, roof shelter, station tiers, anti-clutter cap), integration points, dev spawner, open decisions.
- **`ROADMAP.md`**: tracks **H** (hunger and cooking) and **B** (build), default work H1.
- **`SERVER_PATH.md`** decision D14 (background track). **`Claude.md`** doc-map rows and rule 13.

### Changed

- **`ROADMAP.md`**: default is H1 (was S1f); S1f is a background track; L4 and L5 parked; art stays low priority but wanted; second class allowed if deep; authority order lists the owner resolutions first.
- **`tools/check-docs.mjs`** checks `FOUNDER.md` and `BUILD.md`. `VERSION` 1.16.0.01 to 1.16.0.02.

### Notes

- **Server-ready:** not applicable (docs only); the audit is unchanged.
- Conflicts resolved: the campfire gives +5% regen (stoves add a random-buff chance on top), the Stuffed tier is in v1, the game is not browser-only (exe path S10 stays), the draft's stale inventory status was corrected.
- Not tested: playing in a browser (no code changed).

## V1.16.0.01 — S1f-b Fireball skill presentation out of the sim: the charge and release look is a view (cleanup, no gameplay change)

Second group of S1f (`SERVER_PATH.md` S1f, debt P6): the `Fireball` skill. Before, `onCharging` and `onRelease` spawned rune motes, spiralling embers, the charge light, the discharge ring, the muzzle flash, shook the camera and leaned the caster, so a headless server could not cast. Now the skill holds the numbers, the mana cost, the cooldown, the ball it spawns and the recoil impulse; the look lives in a view found by skill id.

### Added

- **`view/FireballCastView.js`** (client only): everything shown while the key is held and on release, with the same numbers as before. It also sets the view-only field `owner.kick` (the body lean, decayed and drawn by `Player` and `TrainingDummy`, like `flash` and `glow`).
- **`view/SkillViews.js`**: a view system (`world.skillViews`) that feeds `skill:charging` to `view.charging(e)` and `cast` to `view.cast(e)` of the skill with that id; skills with no view are ignored. `SKILL_VIEWS = { fireball: FireballCastView }` in `view/index.js` is the manifest.
- **Event `skill:charging`** `{ owner, skill (id), charge, aim, origin: {x,y,z} }` (`SkillChargingEvent` in `types.js`), emitted by `SkillCaster` on every step a hold-to-charge skill is held. It is generic: later groups (`BurnResistance`) only add a view.
- **`cast` event** now also carries `aim` and `origin` (Fireball only for now). Existing listeners (`XpSystem`, `AudioSystem`) are unaffected.
- **`tests/skill-view.test.mjs`** (8 tests): a cast through `SkillCaster` in a world whose `particles`, `lights`, `camera`, `damageNumbers` and `audio` throw on any use (events, cost, ball, recoil, `kick` untouched); `Fireball.js` has no presentation, visual random, `onCharging` or `kick`; `SkillViews` dispatch and dispose; `FireballCastView.charging` and `.cast` numbers (counts scaled by charge, the 0.45 drip, camera trauma, muzzle fan of 0.4 rad, lights); a full cast on the real `ParticleSystem`, `Lights` and `Camera`; pipeline wiring and a skill that still draws from its own `onCharging`; the same seeded volley of four casts ends in the same sim state with and without the views.

### Changed

- **`Fireball`** lost `onCharging` and every particle, light, camera and `kick` line; `onRelease` keeps cost, the `cast` event, the spawn and the recoil impulse. `SkillCaster` still calls a skill's own `onCharging` (the other skills still draw from it until their group moves out).
- **`tests/mage.test.mjs`**: one pinned assertion changed on purpose. The Fireball cast test used to check `o.kick` = 1.15 after the release; the lean is a view field now, so it checks that the sim leaves `kick` at 0 (the value 0.7 + 0.9 x charge is tested in `skill-view.test.mjs`).
- `npm test` runs sixteen files. `VERSION` 1.16.0.00 → 1.16.0.01. README, ROADMAP (S1f row, Done), `SERVER_PATH.md` (P6, S1f progress), `Claude.md` (code map, rule 3 test list, gotcha), engines doc, guideline status line.

### Notes

- **Server-ready:** debt went down. Audit `Fireball.js` `present` 6 → 0 and `random` 27 → 0; totals `present` 204 → 198, `random` 120 → 93. `SkillCaster.js` stays at 7 (the event is built in a small method without the word `ctx`, which the audit counts as canvas drawing). Baseline rewritten.
- **Checked against the old skill:** a throwaway differential run (old `Fireball` against the new skill plus `SkillViews`, visual randomness seeded, charges of 10, 39 and 78 frames and a five-cast sequence with the caster moving and turning between casts) gave the same particles in the same order with the same values, the same lights, the same camera shakes, the same `kick` value on every frame (including the decay), the same `cast` events, impulses, spawned balls and mana. No difference found.
- Not tested: playing in a browser. Check: holding the Fireball key shows rune motes lifting off the ground circle, embers spiralling into the orb and a growing light; at high charge hot embers drip; releasing leans the caster back, shakes the camera, throws a ring of sparks along the ground and a muzzle flash; the training dummy and the Graugr (if they cast it) look the same; the Burn Resistance charge look is unchanged (it still draws from its own hook).

## V1.16.0.00 — M1: the pure bag primitive (feature, new files only, nothing user-visible)

First stage of the Marble Bag Engine (`docs/proposals/Marble-bag-engine.md`, roadmap track M). It adds the reusable "bag of outcome tokens" and its validator and tests. **Nothing in the game uses it yet**: no skill, entity or scene imports `src/sim/bag/`, so the game plays exactly as before. Fireball crits are still a flat 12% roll until stage M2.

### Added

- **`sim/bag/Bag.js`**: `new Bag(def, { rng })`. A bag holds tokens by name and count (for example `NORMAL: 4, CRIT: 2`), shuffles them into one cycle and draws without replacement, so **every complete cycle holds exactly the configured counts**. `draw()` returns `{ ok: true, token, left, cycle }` or `{ ok: false, reason: "empty" }`; `remaining()` and `counts()` report what is left; `serialize()` and `Bag.restore(def, raw, { rng })` save and rebuild it.
- **`sim/bag/validateBag.js`**: `validateBagDef(def)` returns a list of problems and never throws; `normalizeBagDef(def)` returns a frozen copy (tokens sorted by name) or throws with every problem listed, like `defineItem`. Limits are constants at the top: ids like item ids, token names in capitals (`NORMAL`, `CRIT`), 1 to 16 kinds, 1 to 1000 of each, at most 1000 tokens per cycle.
- **`tests/bag.test.mjs`** (24 tests, added to `npm test`, which now runs fifteen files).

### Decisions taken (all reversible, flagged for the owner)

- **Everything is explicit.** A definition must give `id`, `scope`, `tokens`, `refill` and `hidden`; there are no defaults, as the proposal's design law 2 asks. Unknown fields are refused.
- **Policies in M1:** `refill_shuffle` (the next draw after the last token deals a fresh shuffled cycle) and `no_refill` (the bag stays empty). The proposal's `single_use` and `conditional` need item instances and gates and come with M4 and M3. `persistent` is `serialize` / `restore`, as the proposal itself describes it.
- **`scope`** is validated against `entity`, `skill`, `item`, `world` but the bag does not use it. The combat default (per attacker or per skill, `ASSESSMENT.md` 3.2) is still the owner's decision before M2, and this list may change then.
- **Dealing is lazy.** Building or restoring a bag never calls the rng; the first draw and each refill do, with a Fisher-Yates shuffle from the end that costs exactly n - 1 calls to `next()`. Tokens start sorted by name, so object key order never changes a result (`Claude.md` 5b R9). An exhausted `refill_shuffle` bag shows 0 left until its next draw.
- **The rng is injected and required** (`world.rng`, anything with `next()`); a missing one throws instead of falling back to a fixed seed, because a silent fixed seed would make every caster draw the same crits. The bag never calls `Math.random`.
- **Hidden state:** all state is in `#private` fields, so `JSON.stringify(bag)` is `{}` and a snapshot cannot leak the draw order by accident. `serialize()` is for the server's persistence layer only.
- **`restore` trusts nothing.** Reasons: `corrupt` (wrong shape), `newer_version` (written by a newer game, never overwritten, like the inventory save), `mismatch` (another bag, a token the definition no longer has, or more of a token than a cycle). A failure builds no bag, leaves the input alone and does not touch the rng. A save with fewer tokens than a full cycle is valid: it is a bag in the middle of a cycle, and it still fits if the definition later grows.

### Tests (what they pin)

- 400 different seeds each give exactly 4 NORMAL and 2 CRIT per cycle, with counts falling by one per draw; six cycles in a row stay exact.
- The shuffle is pinned with a scripted rng (a `next()` of 0 gives CRIT NORMAL NORMAL NORMAL NORMAL CRIT, just below 1 keeps the sorted order) and shown unbiased over 60 000 seeds: all six orders of three tokens, and every crit position in the 4 + 2 bag, come up evenly. The proposal's odds hold: the first draw is CRIT 2/6 of the time and 2/5 after a NORMAL.
- Refill and empty behaviour, including that an empty draw uses no randomness; serialize and restore round trips (undealt, mid cycle, exactly exhausted, after a refill) continue exactly like the original; every kind of bad save is refused with its reason; a bare Node process imports the folder with no browser globals.
- **Mutation check:** 13 deliberate bugs in the source (shuffle off by one, biased index, wrong direction, refill policies swapped, cycle not counted, restore skipping the token, version or id check, serialize leaking spent tokens, validator accepting zero counts, no pool bound, unsorted tokens) were all caught by the tests.

### Notes

- **Server-ready:** yes. The two new files have zero audit hits (the audit already scans `src/sim/`), the baseline is unchanged, and the test reads the source for browser, clock and `Math.random` use.
- **Not touched:** `content/index.js`, skills, entities, `world`, saves, UI. No browser test was needed: nothing user-visible changed and nothing imports the new files.
- **Next:** M2 (Fireball crit from a per-caster bag). Its Needs (S1b, S1d) are done, but it needs two owner decisions first: the crit rate (a 22 NORMAL + 3 CRIT pool keeps today's 12%; the proposal's 4 + 2 bag would make it 33%) and whether a bag belongs to the attacker or to the skill. Default if you say "you decide": 22 + 3 per attacker.

## V1.15.0.00 — L2 phase D: the Home Account Inventory (feature, read only)

Third step of the inventory work (`docs/proposals/Inventory-and-ownership.md`, roadmap L2). The Home **Inventory** button now opens a real Account Inventory instead of twelve empty slots. It only shows what the `Inventory` service says is owned; it cannot grant, remove, buy or equip anything.

### Added

- **`ui/InventoryView.js`**: `inventoryModel(inv)` reads the service (entries ordered by category, then name) and `inventoryHtml(model, {tab, selected})` builds the HTML. Pure functions, no DOM. Cards show a category icon, name, rarity and a quantity badge above one. **Tabs exist only for categories you own something in**, with counts; an unknown tab means All. The **detail view** shows name, rarity, category, description, how many you own and "Account-wide". **Equip** is shown disabled ("soon") for equippable items: there is no valid target until character customization (L3). Definition text is escaped.
- **States:** empty ("Nothing owned yet"), service missing ("Inventory unavailable"), a save from a newer game version ("kept untouched and not shown"), a corrupt save, and a repaired save ("N saved entries were not valid and skipped").
- **`tests/inventory-view.test.mjs`** (11 tests): empty state, only owned items listed, tabs and counts and order, filtering, detail and disabled Equip, an unowned id never opens a detail, quantity badge, every state, rendering changes nothing and saves nothing, escaping, and wiring (HomeScene reads `game.inventory`, hardcodes no item id, never grants or removes).
- **Client wiring:** `main.js` creates the one `Inventory` on `INVENTORY_KEY` (`game.inventory`) and exposes it as `lycarius.inventory` next to `lycarius.game` for console debugging.
- CSS for the cards, the quantity badge, the empty and warning boxes and the detail layout (`css/style.css`).

### Changed

- **`HomeScene`**: the Inventory button calls `openInventory()` (the other placeholder buttons still use `openPlaceholder`). `VERSION` 1.14.0.00 → 1.15.0.00. `npm test` runs fourteen files. README, ROADMAP, `Claude.md` (code map, test list), engines doc and the proposal (phase status).

### Notes

- **Nothing can be owned yet.** No Shop purchase, reward or drop grants items, so for players the screen is always empty. To see it, run `lycarius.inventory.grant("ember_robe")` in the browser console (ids: `ember_robe`, `ashen_cloak`, `primordial_garb`, `cinder_halo`, `molten_veil`, `blue_flame_fireball`, `spark_trail`, `bow_of_respect`, `fire_dance`). The grant goes through the service, is validated and is saved in that browser only.
- **Server-ready:** no sim file changed; the audit is unchanged.
- **Not touched:** Shop, Genesis Path, Wallet, Progression, combat. Shop offers are never shown as owned.
- **Tested in a real browser** (headless Chromium over a local server): empty state, grants from the console, tabs and filter, detail, Back, Escape, reload keeps ownership, the progression save is not written by inventory work, a newer-version save is shown as such and left byte for byte unchanged. The only console error is the missing `favicon.ico`, which was already there. Not tested: touch devices and other browsers.
- Next: L4 (Shop buy flow) needs the currency-scope decision first; L3 (character customization) makes Equip real.

## V1.14.0.00 — L2 phase C: ownership state and a separate versioned save (feature, model only, nothing user-visible)

Second code of the inventory work (`docs/proposals/Inventory-and-ownership.md`, roadmap L2). It adds the one place that records who owns how many of which item, and its save. No screen creates or shows it yet (that is phase D), so the game plays exactly as before.

### Added

- **`sim/items/Inventory.js`**: `Inventory(storage)` / `createInventory`, `grant(itemId, qty, ownerId?)` and `remove(...)` (return `{ok, qty}` or `{ok: false, reason}`; a failure changes and saves nothing), `count`, `owns`, `list` (by id), `freeSlots`, `toSave`, and `readSave(raw)` which validates a save without throwing. The definition's `scope` picks the collection: account items are capped at `maxStack` (a cosmetic is owned once), character items live in slots (`ceil(qty / maxStack)` each, `CHARACTER_SLOTS` = 30, a default to confirm at phase E).
- **Save, version 1** on its own key, `INVENTORY_KEY` = `lycarius.primordia.inventory` (added to `core/LocalStorageAdapter.js`): `{ v, account: {items}, characters: {ownerId: {items}} }`. Schema and decisions: proposal section 13.4.
- **`tests/inventory.test.mjs`** (19 tests): grants and removals, duplicate and over-capacity grants, bad quantities and owners, unknown and prototype ids, scope separation, round trip, corrupt and junk saves, a newer-version save kept intact, storage failure, a localStorage round trip that proves the progression save is byte-identical, and no browser, clock or random call.

### Changed

- `npm test` runs thirteen files. `VERSION` 1.13.0.00 → 1.14.0.00. README, ROADMAP (L2 rows, Done), `Claude.md` (test list, code map), engines doc and the proposal (phase status, section 13.4).

### Notes

- **Server-ready:** the new file has zero audit hits; it takes its storage as an adapter and imports nothing from the client.
- **Safety rules:** an entry that is not fully valid is dropped on load, never repaired into an item. A save from a newer game version is never overwritten (every change is refused). A corrupt save starts empty and the next change replaces it.
- **Not touched:** `HomeScene`, `Wallet`, the Shop, `Progression`, `PROGRESS_KEY`, `Player`, combat, RNG, loot. localStorage can be edited by the player, so this save is local prototype storage, not an authority for an online economy.
- Not tested: playing in a browser (nothing user-visible changed). Check: the game starts and loads as before, the Home Inventory button still shows the placeholder, Progression levels still persist across a reload.
- Next: phase D (Home Account Inventory screen). Currency scope must be settled before L4.

## V1.13.0.00 — L2 phase B: item definitions and the ItemRegistry (feature, data only, nothing user-visible)

First code of the inventory work (`docs/proposals/Inventory-and-ownership.md`, roadmap L2). It adds the static description of an item type and nothing else: no ownership, no save, no screen, no combat change. The Home Inventory button still shows its placeholder.

### Added

- **`sim/items/ItemRegistry.js`**: `ItemRegistry` (a `Registry`), `validateItemDef(def)` (returns every problem, never throws), `defineItem(def)` (validates, rejects a duplicate id, registers a frozen copy), `findItem` / `hasItem` (safe lookup for untrusted ids: `null`, never a throw), `allItems()` (ordered by id) and the enums (`ITEM_CATEGORIES`, `ITEM_RARITIES`, `ITEM_SCOPES`, `ITEM_ACTIONS`, `MAX_STACK_LIMIT`). A definition has exactly: `id` (`a-z0-9_`, 2 to 40 characters), `name`, `description`, `category`, `rarity`, `scope` (`account` or `character`), `maxStack` (1 = not stackable) and `actions`. Any other field is rejected, so slots, stat modifiers or recipes must be added on purpose by their own phase.
- **`sim/items/cosmetics.js`**: the nine Shop cosmetics as account-owned, single, equippable definitions (`ember_robe`, `ashen_cloak`, `primordial_garb`, `cinder_halo`, `molten_veil`, `blue_flame_fireball`, `spark_trail`, `bow_of_respect`, `fire_dance`).
- **`tests/items.test.mjs`** (11 tests): each field's bounds, junk input, frozen copies, duplicates, safe lookup (including `__proto__` and `constructor`), id order, the nine cosmetics, a transitional guard that keeps `SHOP.items` and the definitions in step, the existing skill, class and spec registrations, and no browser, clock or random call in the new files.
- **`docs/proposals/Inventory-and-ownership.md`**: the owner's proposal, adopted in stages, with an adoption record (decisions, corrections, phase status) as section 13.

### Changed

- **`content/index.js`** registers the cosmetics (additive; nothing existing was touched). `Registry` is unchanged.
- `npm test` runs twelve files. `VERSION` 1.12.0.06 → 1.13.0.00. README, ROADMAP (L2 rows, Done), `Claude.md` (doc map, code map, rule 3), engines doc (rows for data registries and the item engine).

### Notes

- **Server-ready:** new files have zero audit hits. `tools/server-ready-baseline.json` was refreshed: it still listed the `Progression.js` `dom` debt that S1g removed in V1.12.0.06 (total `dom` 3 → 0).
- **Not touched:** `HomeScene`, `Wallet`, `Shop` data, `Progression`, `PROGRESS_KEY`, `Player`, combat, RNG, loot.
- Not tested: playing in a browser. Check: the game starts and loads as before, the Home Inventory button still opens the placeholder, the Shop still lists nine offers.
- Next: phase C (ownership state and a separate versioned local save). It needs the owner to approve the save schema first.

## V1.12.0.06 — S1g storage adapter: progression saves through an object, not through the browser (cleanup, no gameplay change)

Seventh step of the server path (`SERVER_PATH.md` S1g, debt P7). `Progression` called `localStorage` itself, so it could not run on a server and every test had to fake a global. It now receives a `storage` object with two methods, and nothing in the sim names the browser's storage.

### Added

- **`sim/storage.js`**: the contract (`load()` returns the saved plain-data object or `null`, `save(data)` stores one, neither throws) and `createMemoryStorage(initial?)`, which keeps the object as JSON so callers can never mutate the stored copy.
- **`core/LocalStorageAdapter.js`** (client only): `createLocalStorageAdapter(key, backing?)` and `PROGRESS_KEY`. Corrupt JSON, a non-object value, a blocked or full storage all load as `null` and never throw. The key is unchanged (`lycarius.primordia.progress`), so existing saves still load.
- **`tests/storage.test.mjs`** (6 tests): both adapters, copy semantics, corrupt and throwing storage, lazy read of the global, and a check that `Progression.js` no longer mentions `localStorage`, `sessionStorage`, `document` or `window`.

### Changed

- **`Progression(cls, storage = createMemoryStorage())`** and `progressionFor(classId, storage)`; load and save go through the adapter, same save format (version 1). Without a storage a private in-memory one is used, so a forgotten argument cannot write to a real save.
- **`WorldScene`** passes the localStorage adapter. **`loadTasks`** (the loading screen's world dry run) passes an in-memory one, so loading no longer reads the real save (P13).
- **Tests**: `mage.test.mjs` uses a `createMemoryStorage()` store (the global `localStorage` stub is gone) and its save test also covers junk saves, two stores, two classes in one save and a throwing store; the `localStorage` stubs in `abilities`, `damage` and `input` tests are removed; `helpers.mjs` exports `createMemoryStorage` instead of `memoryStorage`.
- `npm test` runs eleven files. `VERSION` 1.12.0.05 → 1.12.0.06. README, ROADMAP (S1g row removed, Done), `SERVER_PATH.md` (P7, P13, S1g, debt list), `Claude.md` (code map, rule 3), guideline G4 hook.

### Notes

- **Server-ready:** debt went down. Audit `progression/Progression.js` `dom` 3 → 0, total `dom` 3 → 0. Baseline rewritten. `core/Settings.js` still uses `localStorage` directly; it is client-only code, outside the audit.
- Not tested: playing in a browser. Check: level up and pick a bonus, reload the page, the level and picks are still there; an old save from before this version still loads; Settings → reset progression still clears it; the loading screen still reaches the game.

## V1.12.0.05 — S1f-a projectile presentation out of the sim: the fireball is sim only, its look is a view (cleanup, no gameplay change)

First group of S1f (`SERVER_PATH.md` S1f, debt P6): the Fireball projectile. Before, `FireballProjectile` spawned embers, smoke and a light, kept a trail history and drew itself, so a headless server could not run it. Now the class holds movement, the hit order (clash, deflect, shield, body), the damage roll and the range; everything you see lives in a view registered by the entity's `kind`.

### Added

- **`view/FireballView.js`** (client only): the trail history (points live 0.32 s), the ember and smoke particles, the one-frame moving light, the fizzle burst and `draw`, with the same numbers as before. Per-ball animation state (trail, flicker clock) sits in a `WeakMap` in the view, not on the entity.
- **`view/EntityViews.js`** and **`view/index.js`**: `EntityViews` finds a view by `entity.kind`; `update(dt)` ticks the views of the entities that just ran, `draw(ctx, e)` draws one entity and falls back to `e.draw` for kinds without a view yet. `view/index.js` is the one manifest (`VIEWS = { fireball: FireballView }`). `EntityViews` is a new view system in `systems/pipeline.js` (`world.entityViews`).
- **Event `projectile:fizzle`** `{ kind, x, y, z, charge }` (plain data, `ProjectileFizzleEvent` in `types.js`), emitted when the range runs out.
- **`Entity.kind`** (string, default `""`): the view key. An entity with a view does not draw itself.
- **`tests/projectile-view.test.mjs`** (9 tests): a fireball lives through range, body hit, shield and clash in a world whose `particles`, `lights`, `damageNumbers`, `camera` and `audio` throw on any use; the fizzle event is plain data; `FireballProjectile.js` has no presentation, clock or visual random; the view's embers, light, trail culling, fizzle burst and `draw` (finite canvas arguments, composite mode restored, real `ParticleSystem` and `Lights`); `EntityViews` dispatch and dispose; pipeline and `WorldScene` wiring; the same seeded volley ends in the same sim state with and without the view.

### Changed

- **`FireballProjectile`** lost `draw`, `fizzle`, `trail`, `t` and every particle and light call; it emits `projectile:fizzle` instead. It sets `kind = "fireball"`.
- **`WorldScene`** calls `entityViews.update(edt)` right after the entities update (before the dead are removed) and draws every entity through `entityViews.draw`.
- `npm test` runs ten files. `VERSION` 1.12.0.04 → 1.12.0.05. README, ROADMAP (S1f row, Done), `SERVER_PATH.md` (P6, S1f progress), `Claude.md` (code map, rule 3 test list, projectile gotcha), engines doc, guideline status line.

### Notes

- **Server-ready:** debt went down. Audit `FireballProjectile.js` `present` 22 → 0 and `random` 18 → 0 (the visual `rand` / `Math.random` moved to the view); totals `present` 226 → 204, `random` 138 → 120. Baseline rewritten.
- **Checked against the old class:** a throwaway differential run (old `FireballProjectile` against the new sim plus view, visual randomness seeded, four scenarios: range, body, shield, clash) gave the same particle and light calls, the same `hit` and `explosion` events and the same canvas calls for one ball, for a body hit and for a shield. Three small differences remain, none visible in play: (1) with two balls alive in one step, the particles of ball 2 are emitted after those of ball 1 instead of in between (same particles, different random numbers); (2) a ball destroyed by a clash earlier in the same step now still sheds its last 4 to 7 embers and its one-frame light under the clash explosion (before, it skipped them); (3) when the clash is detected by the other ball after this ball already ticked, the survivor's embers of that one frame use the already weakened radius (a spread of 1 to 2 px).
- Not tested: playing in a browser. Check: a Fireball at any charge looks as before (tapered trail, ember rain, glow, light on the ground), a ball that flies out of range bursts into sparks, two balls colliding still explode, a flame shield and the Graugr arms still stop and deflect balls, the training dummy still dodges them, and the frame rate with many balls is unchanged.

## V1.12.0.04 — S1e input command layer: the player is driven by a command, not by the keyboard (cleanup, no gameplay change)

Fifth step of the server path (`SERVER_PATH.md` S1e, debt P5). A server cannot read a keyboard, a mouse or a camera, and it must not trust what a client sends. The player now receives one validated command per tick; a client-only controller builds it from the devices.

### Added

- **`sim/InputCommand.js`**: `InputCommand { seq, mx, my, aim, btn }`, `idleCommand()` and `sanitizeCommand(raw, lastSeq)` (R11, constants at the top). Axes are clamped to -1..1 and a longer diagonal is scaled to length 1; NaN and Infinity become 0; `aim` is wrapped into -PI..PI; `btn` must be an integer and is masked to 16 bits; a `seq` that is not newer than the last one is dropped.
- **`input/PlayerController.js`** (client only): reads `Input` and the camera and sends the command with `player.applyCommand`. It is the only place that maps keys to skills (`slot.keys`, class data). `btn` bit i means "the i-th skill slot is held".
- **`tests/input.test.mjs`** (8 tests): validation; scripted commands move the player (right, diagonal at the same speed, half stick at half speed, idle stops) and set its aim in a world with no `input`, `camera.screenToWorld` or `game`; hold-to-charge and a toggle skill (press, not hold); stun and downed ignore commands; an old `seq` is ignored; `PlayerController` builds the right command from keys, mouse and camera; `Player.js` source has no input access.

### Changed

- **`Player`** has `cmd`, `applyCommand`, `slotBit`; `update` reads `mx my aim` from `cmd`, `wantsCast` reads the held bit and `wantsToggle` the rising edge (`btnPrev` / `btnNow`). Movement keeps its numbers (speed, 0.55 while charging, the same smoothing); the length divisor is `max(1, hypot)`, identical for keyboard input.
- **`WorldScene`** creates the controller and calls it once per frame before the entities update.
- **`tests/abilities.test.mjs`** now drives the player through a `PlayerController` over its key stubs (a key press is held for one frame).
- `npm test` runs nine files. `VERSION` 1.12.0.03 → 1.12.0.04. README, ROADMAP (default is now S1f), `SERVER_PATH.md`, `Claude.md` (R4, code map, gotchas), engines doc, guideline status line.

### Notes

- **Server-ready:** debt went down. Audit `input` hits 6 → 0 and `Player.js` `present` 23 → 22 (the camera call); baseline rewritten. Player-only debt left: `settings` 2 and `present` 22, all in `draw`.
- **Two small behaviour differences, both invisible in play:** the aim angle is computed from the player's position at the start of the frame, not after it moved (at most about one frame of lag); a skill key pressed while the game is paused now registers on the first frame after resuming (before, the press was lost). A tap shorter than one frame no longer counts as a press.
- Not tested: playing in a browser. Check: WASD and arrows move (diagonal not faster), the mouse aims, Fireball charges and fires, Flame Shield, Burn Resistance, Fire Blast, Mana Regen and Dodge work on their keys, E / Q / F toggles do not flicker when held, stun and downed block everything.

## V1.12.0.03 — S1d damage out of the view: `DamageSystem` applies hits, the view only draws (cleanup, no gameplay change)

Fourth step of the server path (`SERVER_PATH.md` S1d, debts P3 and P4). Before, damage landed because `HitEffects`, a presentation class, called `target.onHit`. A headless server has no `HitEffects`, so nothing would have taken damage, and "create X after HitEffects" was a hidden rule. Now one sim system applies hits and the view only reads the same event.

### Added

- **`systems/DamageSystem.js`** (sim): on `hit`, calls `target.onHit(e, world)`. Zero audit hits.
- **`systems/pipeline.js`**: the one ordered list of world systems. `SIM_SYSTEMS` (damage, status, explosions, xp) come before `VIEW_SYSTEMS` (hitEffects, burnFx, manaRegenFx, dodgeFx, explosionFx, blastFx); `createSystems` and `disposeSystems` build and tear down a list. Listeners on one event run in creation order, so this order is the rule.
- **`tests/damage.test.mjs`** (9 tests): the pipeline order; Player, Graugr and TrainingDummy take hit and burn damage in a world with **no** `HitEffects` (and keep `flash` at 0); a killing blow downs the target before ignition is rolled; `DamageSystem` receives and passes the world and stops after `dispose`; `HitEffects.js` has no `onHit` call left; with the view systems on, a hit sets `flash` to 1 and `glow` to 1 on the dummy, a burn tick sets 0.55 on the player and 0.8 on others; the same seeded Graugr fight (both sides take damage) ends in an identical sim state with and without the view systems.

### Changed

- **`onHit` / `onDot` are sim only.** `Player` (health, knock, downing), `Graugr` (knock, `hurt`) and `TrainingDummy` (`freeze`, knock spring, damage totals, DPS log, health when it attacks) no longer set `flash` or `glow`. `HitEffects` sets `flash = 1` (and `glow = 1` where the entity has one) on every hit; `BurnFx` sets 0.55 (player) or 0.8 (others) and `glow` on every burn tick. The entities still fade and draw them. Same numbers as before.
- **`WorldScene`** builds and disposes systems through `pipeline.js` instead of ten loose `new` lines. Creation order changed (sim systems first), with the same relative order of damage, status and XP as before.
- `HitEffects`, `BurnFx`, `Entity.js` headers and JSDoc say what is sim and what is view. `tools/audit-server-ready.mjs` lists `systems/DamageSystem.js`. `npm test` runs eight files. `VERSION` 1.12.0.02 → 1.12.0.03. README, ROADMAP (default is now S1e, M2 unblocked), `SERVER_PATH.md` (S1d, P3, P4, debt log, hooks), `Claude.md` (code map, gotchas, verify step), engines doc, guideline and assessment status lines.

### Notes

- **Server-ready:** debt unchanged (the baseline is not rewritten). Two debt-log lines are gone (P3, P4); the `Graugr` death still calls `world.particles` directly (existing `present` debt, S1f), which is why stub worlds keep no-op particles.
- **`staggerT` was not added.** The S1d text names it, but the code has no stagger that cancels casts today. The dummy's `freeze` (it stops steering) stays a sim value in `onHit`. Inventing a timer nothing reads would be new gameplay; it arrives with the first interruptible caster.
- Not tested: playing in a browser (`WorldScene.enter` and `exit` were syntax-checked only). The check: hits still flash the dummy, Graugr and player; burn ticks flash and the dummy glows; exiting to the menu and re-entering the world still works.
- Order of listeners changed slightly (damage, status, explosions and XP now come before the view systems). The seeded-fight test shows no sim difference; draw order of effects within one event is the only thing that could differ, and it is cosmetic.

## V1.12.0.02 — S1c sim clock: `world.time` replaces the wall clock in sim code (cleanup, no gameplay change)

Third step of the server path (`SERVER_PATH.md` S1c). Simulation code may not read a wall clock (R2): a server steps time itself, and a replay must not depend on when it runs. The only sim-side user was the training dummy's DPS readout.

### Added

- **`world.time`**: the simulation clock in seconds, created in `WorldScene.enter` and advanced once per sim step in `WorldScene.update` by the same `dt` the entities receive, before they run. It stops while the game is paused and slows during hit-stop, exactly like every cooldown and timer.
- **`tests/clock.test.mjs`** (4 tests): `step()` advances `world.time` by `DT` per frame; the DPS window is 5 s of sim time (hits and burn ticks count, a 5.0 s old entry drops out, the total is not windowed, a burn tick is not a hit); DPS works with `performance.now` replaced by `NaN` and with `world.time` at 1,000,000; a burn on the dummy reaches `onDot` with the world and shows up in DPS.
- `tests/helpers.mjs`: `mkWorld()` has `time = 0` and `step()` advances it like `WorldScene.update` does.

### Changed

- **`onHit(e, world)` and `onDot(e, world)`**: `HitEffects` and `StatusSystem` now pass the world as a second argument (additive: `Player` and `Graugr` ignore it). `TrainingDummy` stamps its damage log with `world.time` and `dps(world)` averages over `DPS_WINDOW` (5 s, a constant at the top of the file). The HUD calls `d.dps(this)`. JSDoc in `Entity.js` and `types.js` updated.
- The DPS readout now measures sim time instead of wall time, so it no longer keeps counting while the game is paused (the old window kept running). Otherwise it reads the same.
- `npm test` runs seven files. `VERSION` 1.12.0.01 → 1.12.0.02. README, ROADMAP ("Choosing work" default is now S1d), `SERVER_PATH.md` (S1c done, P2, debt log, hooks), `Claude.md` (R2, code map, gotchas), guideline status line.

### Notes

- **Server-ready:** debt went down. Audit `clock` hits 6 → 3, baseline rewritten. The 3 left are in `draw` code (`TrainingDummy` ground circle and aura, `Graugr` arm swing animation phase) and leave in S1f, which is what the step's "0 outside draw code" allows. `TrainingDummy.js` has no clock outside drawing any more.
- Mutation check by hand: putting the dummy's three clock sites (hit, burn tick, readout) or the `onDot` world argument back to the old code made `tests/clock.test.mjs` fail every time.
- Not tested: playing in a browser (`WorldScene.update` was syntax-checked only; its new lines are `this.time += edt` and `d.dps(this)`).
- Built on V1.12.0.01: the UI and Settings release took V1.12.0.00 while S1c was in progress, so this step was renumbered from V1.11.2.02 to V1.12.0.02 and merged onto that code. `WorldScene.js` merged without conflicts; the audit baseline was regenerated, and it differs from V1.12.0.01 only in the `TrainingDummy` clock count (5 to 2).

## V1.12.0.01 — Docs: engines and systems guideline (cleanup, no code change)

- **`docs/ENGINES_AND_SYSTEMS.md`** (new): the Gemini engine and system roadmap, reconciled with this repo. Early (E1), mid (E2) and scale (E3) tables give each system, what it does, its `Status` (Built, Planned with a step, Not planned) and `Where` it lands; E4 lists known differences from the source; E5 is a checklist for creating a system. Stated everywhere as a guideline, not the truth.
- `Claude.md`: doc-map row, new session rule 11 (open it before creating or reviewing a system or engine); the doc-structure rule is now rule 12. `VERSION` 1.12.0.00 to 1.12.0.01. No game code changed.

## V1.12.0.00 — Modal X fix, buff visual language, sectioned Settings with a fixed footer

### Fixed

- **Home scene: the "X" on every modal (Profile, Shop, Genesis Path, Messages and the placeholder panels) did nothing.** Cause: the close handler tested `e.target.dataset.a`, but the click lands on the SVG icon inside the button, which has no `data-a`; only the thin border of the button worked. `ui/Modal.js` now uses `e.target.closest("[data-a=close]")`, and `.ic { pointer-events:none }` makes icons transparent to clicks everywhere.
- **Two buffs at once over-glowed the character** (Mana Regen plus Burn Resistance stacked two additive radial glows, two lights and a tinted body). Buffs no longer glow; each has its own particle signature (see below).

### Changed (buff visuals: a shared visual language)

| Meaning | Signature | Used by |
| ------- | --------- | ------- |
| Regeneration / restoring | Hollow **circles** (bubbles) rising around the body | Mana Regen (blue) |
| Resistance / protection | Long flexible tinted **ribbons** winding up the body | Burn Resistance (red-orange) |
| Motion / haze (reserved) | Short thin solid **dashes** along the velocity | Burn Resistance movement trail now; haste and haze later |

- New particle shapes `bubble` and `dash` in `ParticleSystem` (`len` field for the dash), new `render/drawRibbons.js`. `ManaRegenFx` lost its body glow (and its `render`); `BurnWardEffect.draw` draws ribbons instead of `drawAura`. Lights are weaker (Mana Regen 0.45 to 0.15, ward 0.35 to 0.12), the ward body tint is 0.18 (was 0.45), embers 22/s to 10/s. Self-skill casting (charge) still uses the aura.

### Changed (Settings, UI and UX)

- **Settings are split into sections** (Audio, Graphics, Interface) in cards, with a chip bar that jumps to a section. New shared panel `ui/SettingsPanel.js`; a new setting is one row object.
- **Home Settings holds player preferences only.** Developer options are gone from the lobby.
- **In-game Settings** (Pause menu, new **Settings** button) adds **Training Dummy** (attacks, skills, movement; Save rebuilds the dummy at once, no need to re-enter) and **Developer** (debug FPS, cast timer, XP tools). The XP tools now act on the running world (the player levels up live) and **Reset progression asks to confirm**.
- **Fixed footer: Reset, Save, Back.** The body scrolls, the footer does not. Editing is staged: changes apply live (you hear and see them) and are written only on Save. Reset loads the defaults for the settings on that panel (still needs Save). Back with unsaved changes asks **Save / Discard** (X or Esc keeps editing). Save is disabled when nothing changed, the footer says "Unsaved changes" or "All changes saved", Esc acts as Back.
- Version 1.11.2.01 to 1.12.0.00.

### Tests

- `tests/visuals-settings.test.mjs` (3 tests): bubble / dash shapes draw finite numbers, ribbons, staged Settings. `tests/abilities.test.mjs` now asserts Mana Regen emits bubbles. `npm test` runs six files. Browser-checked with Playwright (modal X, settings sections, sticky footer, discard, in-game settings, both buffs on screen).

## V1.11.2.01 — S1b seeded RNG: every gameplay roll comes from `world.rng` (cleanup, no gameplay change)

Second step of the server path (`SERVER_PATH.md` S1b). A server must be the only source of dice, and tests must be able to replay a fight, so gameplay randomness no longer touches `Math.random`.

### Added

- **`src/sim/rng.js`**: class `Rng`, the mulberry32 generator, with `next()` (float in [0, 1)), `range(a, b)`, `chance(p)`, plus `state()` / `setState()` (the whole state is one 32-bit integer). It matches the canonical mulberry32 stream (seed 1 starts 0.62707...). No browser, no clock.
- **`world.rng`**, created in `WorldScene.enter` from `new WorldScene({ seed })`; with no seed the run takes `Date.now()` (client side, outside the sim). The seed is kept as `world.seed`.
- **`tests/rng.test.mjs`** (10 tests): the generator itself (pinned stream, bounds, uniformity, state resume), the S1b "done when" (same seed twice gives identical Fireball damage lists, different seeds differ), and three scripted fights (a raid, a Graugr duel, a hostile dummy that dies and respawns). The fights must be identical for the same seed, different for different seeds, and **identical when `Math.random` is replaced by other streams**, which proves no gameplay roll still reads it. Each fight also asserts that it reached the code it guards (crit, burn, nullify, deflect, strafe, respawn).
- Test helpers: `ScriptedRng`, `withRng(w, seq, fn)` and `dice(seq)` in `tests/helpers.mjs`; `mkWorld()` there now carries a seeded `rng`.

### Changed

- **Classification.** Every `rand(` / `Math.random` in a simulation file was sorted into G (gameplay) or V (visual only). G sites now use `world.rng`: Fireball crit (12%), damage spread (0.9 to 1.1) and burn duration (`FireballProjectile.roll` / `hit`), ignition chance (`StatusSystem.onHit`), Burn Resistance nullify chance (`BurnWardEffect.tryNullify`), explosion spread (`ExplosionSystem`), raid spawn angles and distances (`RaidSystem`), Graugr deflect chance and angle, strafe flips, dodge side and start values, and the dummy's cast timer, charge target and orbit flips. V sites (particles, shake, audio, damage-number drift, `Graugr.swingA`, which only drives the drawing) stay on `rand` and move out of the sim in S1f.
- **Signatures.** `FireballProjectile.roll(world)`, `hitShield(shield, world)` and `TrainingDummy.respawn(world)` now take the world. `Graugr` and `TrainingDummy` constructors take an optional `{ rng }` for their first values (`RaidSystem` and `WorldScene` pass `world.rng`); without it they start from fixed values (strafe left, 3 s; dummy timers 4.5 s and 2 s) instead of `Math.random`.
- The order of rolls is unchanged (crit, then spread; ignition chance, then nullify), so every number pinned in `tests/mage.test.mjs` (52 tests) still holds. Its `Math.random` stub (`withRandom`) is gone; `tests/fireblast.test.mjs` and `tests/graugr.test.mjs` give their stub worlds an `rng` (the Graugr file only gained that one field, it stays the pinned baseline).
- `npm test` runs five files. `VERSION` 1.11.2.00 → 1.11.2.01. README, ROADMAP ("Choosing work" default is now S1c), `SERVER_PATH.md` (S1b done, P1, debt log, hooks), `Claude.md` (R3, code map, verify step, gotchas), guideline and assessment status lines.

### Notes

- **Server-ready:** debt went down. Audit `random` hits 160 → 139 (`TrainingDummy`, `ExplosionSystem`, `RaidSystem`, `StatusSystem` are now at 0); baseline rewritten. The 139 left are all visual (particle sprays, `core/math.js` `rand` itself) and leave in S1f.
- Behaviour for the player is the same: the same chances and ranges, drawn from a seeded stream instead of the browser's. Individual fights differ from run to run as before, because each run picks a fresh seed.
- Mutation check done by hand: each of the 21 converted sites was put back on `Math.random` one at a time and `tests/rng.test.mjs` failed every time.
- Not tested: playing the game in a browser (`WorldScene.enter` was syntax-checked only; its new lines are `new Rng(seed)` and passing `rng` to the dummy).

## V1.11.2.00 — Mana Regen (Mage passive) and Dodge (universal ability)

### Added

- **Mana Regen** (`skills/ManaRegen.js`, `ManaRegenEffect.js`, `systems/ManaRegenFx.js`): Mage-only, free, no cast time. Press `F`: mana regeneration x5 for 30 s, 3 minute cooldown. Owned from class selection (it is in `specialization.start`, no unlock level). Blue glow and rising motes on the body, a blue status icon with a time-left bar beside the bars, and a blue glow on the mana bar while it runs. Icon: a human silhouette with a blue enhancement arrow stack.
- **Dodge** (`skills/Dodge.js`, `classes/Universal.js`, `systems/DodgeFx.js`): universal, 20 stamina, 25 s cooldown. Press `Shift`: slide 130 px straight backwards (away from the aim) over 0.32 s, decelerating, so it is not instant. Untouchable for the first 0.18 s. Cancels a cast in progress; no casting while it runs. A yellow line trail (streak plus fading body outlines) follows the dodger. Icon: a yellow silhouette leaning back with speed lines. First skill to spend stamina.
- **`instant` skill type** in `SkillCaster`: one key press fires the skill, no charge. Optional `canUse(owner)` / `onDenied(owner)` for non-mana costs, `activeFrac`, `color`, `costText` on `SkillDef`.
- `Vitals.manaRegenMult`, `Player.startDodge` / `stepDodge`, `manaRegen` and `dodge` events (types in `types.js`).
- `tests/abilities.test.mjs` (10 tests); `npm test` runs both test files.

### Changed

- HUD: skill circles can carry their own colour (`--tone`); a stamina bar flashes red when a Dodge is refused; status icons can carry a colour. Character panel lists every starting skill and the universal skills, and shows `costText` where a skill has one.
- `VERSION` 1.11.1.00 → 1.11.2.00.

### Notes

- Server-ready: no new debt (audit counts unchanged, new files have zero hits).
- Design defaults chosen where the brief was silent: Mana Regen is pressed (`F`), x5 multiplier; Dodge has 0.18 s of invulnerability, 130 px, `Shift`. All are constants at the top of the skill files.

## V1.11.1.00 — Fix: Fire Blast froze the game

### Fixed

- **Pressing `R` froze the game and the character vanished.** Cause: `Player.draw` tints the body with `casting.palette.main` while a self skill is being cast, and Fire Blast (a self skill) had no `palette`, so the first frame of the cast threw `TypeError: Cannot read properties of undefined (reading 'main')` and the render loop died. Burn Resistance never hit it because it carries `WARD_CIRCLE`.
- `FireBlast.palette` is now `FIRE_CIRCLE`, and `Player.draw` falls back to `FIRE_CIRCLE` for any self skill without a palette, so a future self skill cannot take the game down the same way.

### Added

- Three regression tests in `tests/fireblast.test.mjs` (now 15): the player draws at charge 0, 0.3 and 1 while casting Fire Blast; every self skill of the class has a complete palette; and a full 2 s cast with the **real** `ParticleSystem`, `Lights` and `Camera` updates and renders every frame with no NaN or Infinity argument, exactly one blast, 70 damage and the 60 s cooldown running.

### Notes

- Why V1.11.0.00 missed it: its tests covered the simulation and the particle numbers, but never drew the player while casting. The rule in `Claude.md` (drawing is checked with a Proxy ctx) now has a test for every self skill. Server-ready: yes, no new debt. S1 sub-steps now start at V1.11.1.01.

## V1.11.0.00 — Fire Blast (new Mage skill)

### Added

- **Fire Blast** (fire mage skill, `R`, hold): a self-centred AOE. Hold `R` for 0.5 s until the circle completes, then one big fire blast goes off in all directions. Costs 40 mana, 60 s cooldown. Unlocks at specialization level 8 (see Changed).
  - Damage 70 flat (no falloff, no crit) to everything hittable whose body edge is within 240 px of the caster. The caster is never hurt. Skill damage and element damage multiply it; a Burn Resistance ward reduces it like any fire damage.
  - Knockback: every target in range gets a 1500 px/s radial impulse away from the caster (about 215 px of travel), added to the target's own hit reaction.
  - Status: 40% chance per target to set it on fire (6 s, 8 damage per second, boosted by element damage), rolled by `StatusSystem` like Fireball burn.
- `src/skills/FireBlast.js` (simulation code, zero audit debt: no randomness, no drawing), `src/systems/BlastFx.js` (rings, fire billow, sparks, smoke, light, shake; client only), new world event `blast` (`BlastEvent` in `types.js`), `blast` icon, `AudioSystem.onBlast` (explosion boom at full strength).
- `SkillDef.noAi`: skills the enemy and dummy AI must not receive. The hostile dummy in skills mode now builds its caster from the class skills without them, so it never casts Fire Blast.
- `tests/fireblast.test.mjs` (12 headless tests); `npm test` runs all three test files.

### Changed

- **Mage specialization:** Fire Blast unlocks at level **8** (was a bonus-pick level). Levels 2, 3, 4, 6, 7 and 9 keep their picks, so the tree now has 6 picks instead of 7. A saved pick at level 8 is ignored on load.
- **S1a safety net, three deliberate pin updates** in `tests/mage.test.mjs`: `Mage.skills` gains `fireBlast`, `choiceLevels()` loses 8, and the fully unlocked list gains `fireBlast` (between Flame Shield and Burn Resistance).
- **Version plan:** S1 sub-steps now start at `V1.11.0.01` and the closing S1 release moves from V1.11.0.00 to **V1.12.0.00** (`SERVER_PATH.md` S1 and S1k, `ROADMAP.md`, `ASSESSMENT.md`).
- `VERSION` 1.10.0.05 → 1.11.0.00. README, ROADMAP, `Claude.md` updated.

### Notes

- Casting Fire Blast does not emit `cast`, so it gives no flat spec XP (only the XP from damage dealt). Server-ready: yes, no new debt.

## V1.10.0.05 — S1a safety net: characterization tests for the Mage kit (tests only, no gameplay change)

First step of the server path (`SERVER_PATH.md` S1a). The tests pin what the code does today, so every later S1 step can prove it changed nothing.

### Added

- **`tests/mage.test.mjs`** (52 tests) and **`tests/helpers.mjs`** (stub world, fixed stepping, event capture, controlled randomness, in-memory storage). Covered:
  - Fireball: mana cost by charge (5 to 20), affordable charge, damage by charge (8 to 30, exponent 1.3), crit (12%, x1.75, half-up rounding), spread 0.9 to 1.1, specialization multipliers, damage rolled once, projectile speed and size, height gate, range 1200, burn chance and duration by charge, Burn Resistance on hits.
  - Cooldowns and casting through the real `SkillCaster`: 0.7 s cooldown, minimum charge 0.12 (10 frames), mana cap on charge, low-mana flash, cast-time and cooldown modifiers, recoil, Flame Shield toggle (cost 10, upkeep 5/s, instant drop, 0.6 s re-raise), Burn Resistance cast (1.2 s, 25 mana, refresh).
  - Burn: ignition gate, one tick per whole second, refresh instead of stacking, ward halving and nullify, snuffing a running burn, stopping on a downed target.
  - Flame Shield: absorb and leftover, break, blocking geometry (arc, range, height, 35% rise), shield versus Fireball.
  - Explosions: radius and centre damage by charge, linear falloff to 30%, spread, multipliers, caster hurt, ward applies, shields do not stop it.
  - Clashes: tie window 0.12, survivor weakening, explosion charge, one explosion per clash in flight, same owner and height gap.
  - XP and levels: both XP curves, level thresholds and caps, events, specialization unlocks and picks, folded modifiers, save and load, `XpSystem` rules (1 XP per damage point, kill bonus 50 once, burn ticks, cast XP 2 to 5).
- **`npm test`** now runs both test files.

### Changed

- `VERSION` 1.10.0.04 → 1.10.0.05. README, ROADMAP (Done row, "Choosing work" default is now S1b), `SERVER_PATH.md` (gate 1, S1a marked done, debt log), `Claude.md` (verify step, code map), guideline status line.

### Notes

- No file under `src/` changed except `config.js`. Gates: `node tests/graugr.test.mjs` 6 passed, `node tests/mage.test.mjs` 52 passed, audit PASS with the counts unchanged (3, 6, 160, 4, 227, 6, 6), docs check PASS.
- The tests have teeth: 23 single-number mutations of the source (damage, cost, cooldown, crit, tie window, falloff, tick length, upkeep, XP curve, and more) were each caught.
- Behaviour pinned as found, not as designed: a burn tick can land one frame late because 120 accumulated 1/60 steps sit a hair under 2.0 s; crit damage rounds half up (52.5 becomes 53); dropping Flame Shield ignores its cooldown; an explosion hurts its own caster.
- The tests stub `Math.random` and a global `localStorage`. Both stubs are removed when S1b (seeded RNG) and S1g (storage adapter) land (debt log).
- Not covered on purpose: `HitEffects` and `Player.onHit` (presentation and input, split in S1d), drawing and audio.

## V1.10.0.04 — MMORPG guideline, work-choosing rule, doc structure check (docs and tooling only, no gameplay change)

### Added

- **`docs/MMORPG_GUIDELINE.md`**: the Gemini seven-part MMORPG sequence (G1-G7) reconciled with this repository. Each part has the source idea, the source evidence tagged common practice / anecdotal / measured, a verdict (ADOPT, ADAPT, REJECT-PART), do, do not, repo hooks and a gate. G8 lists conflicts with project rules (30 Hz not 20 Hz, no `Date.now()` or `Map` in sim state, no Socket.io, Prisma, Knex, Phaser, Pixi, ESLint or workspaces without approval, 10-50 players not 100+). G9 gives the order from today. It is a guide, not the truth.
- **ROADMAP "Choosing work"**: what any Claude does when the user does not know what to work on (candidates with Needs and a default, S1a).
- **`Claude.md`** session rules 10 (read the roadmap, then use the guideline as a guide only) and 11 (doc structure rule), a doc-map row, and a definition-of-done line.
- **`tools/check-docs.mjs`** (`npm run docs`): fails on a missing title or sections, mixed line endings or a missing doc-map file; warns on a leaf section over 60 lines.

### Changed

- `SERVER_PATH.md` S1: sub-step versions now start at `V1.10.0.05`.
- `VERSION` 1.10.0.03 → 1.10.0.04. README version strings, ROADMAP Done row.

### Notes

- Nothing built; no dependency added. Gates unchanged: tests pass, audit PASS, docs check PASS.

## V1.10.0.03 — Art style decided, art intake and map plan (docs only, no gameplay change)

### Added

- **`docs/ART_AND_MAPS.md`**: owner decision **semi-pixelated** (32 px tiles, 32x48 px frames, 1 world unit = 1 art pixel, integer `PIXEL_SCALE` 2 or 3); pixel rendering rules; track A (sprite manifest, `drawSprite`, cylinder fallback, camera scale, animation state, optional effect art); track T (Tiled JSON loader, collision grid in the sim, objects layer, two zones, dev overlay); fixed map format; Tiled setup steps; risks.
- **ROADMAP "Art and maps"**: stages A1-A4 and T1-T5 with prerequisites; "Then: world" now points to track T.
- `Claude.md`: doc-map row, architecture rule 7 (art) and code-map line.

### Changed

- `SERVER_PATH.md` D12: "art undecided" replaced by the semi-pixelated decision. No phase is blocked.
- `VERSION` 1.10.0.02 → 1.10.0.03.

### Notes

- Nothing built; characters stay cylinders until A1. Gates unchanged: 6 tests pass, audit PASS (3, 6, 160, 4, 227, 6, 6).

## V1.10.0.02 — Design proposals assessed, proposals roadmap, section reader (docs and tooling only, no gameplay change)

### Added

- **`docs/proposals/`**: `Marble-bag-engine.md` and `World-Division-and-Lag-Management.md` kept verbatim for reference, plus `ASSESSMENT.md`: Phase 0 inspection findings, verdicts (both feasible in stages; WDL's 100 players / 400 NPCs is a design ceiling, not a target), conflicts and default decisions, staged plans M1 to M5 and W1 to W5, risks and session rules.
- **ROADMAP "Proposals"** tracks M and W with prerequisites; **`SERVER_PATH.md` section 8** lists the hooks S1b, S1c, S1d, S1h, S1k, S2, S5 and S6 must provide.
- **`tools/sec.mjs`** (`npm run sec -- <file> [id]`): lists headings or prints one section (by id such as `5b`, `S1f`, `M2`, `V1.9.0.00`, or heading text), so sessions read a section instead of a whole file.
- **`Claude.md` doc map (1b)** and session-protocol rule 9: which doc and section to open for which kind of work, and when the proposal files must be opened.

### Changed

- `VERSION` 1.10.0.01 → 1.10.0.02. S1 sub-step versions now start at V1.10.0.03.

### Notes

- Nothing from either proposal is implemented. Gates unchanged: `node tests/graugr.test.mjs` 6 passed, audit PASS (3, 6, 160, 4, 227, 6, 6).

## V1.10.0.01 — Server path, server-ready rules, audit tool and tests, home-PC hosting and exe plan (docs and tooling only, no gameplay change)

This is the V1.9.0.01 package, which was not applied before V1.10.0.00 shipped. It is applied here on top of V1.10.0.00 and renumbered (V1.9.0.01 would have been a version older than the code), so every phase version in `SERVER_PATH.md` is one minor higher than in the first draft.

### Added

- **`SERVER_PATH.md`**: the road to online. Thirteen architecture decisions (server-authoritative, same Node code as the browser, WebSocket, fixed 30 Hz simulation, JSON first, SQLite, username + password accounts, rooms, own-PC hosting first then a small VPS, the exe as a wrapper), an audit of the current code (problems P1 to P13), and ten phases S1 to S10 with exact steps, "done when" tests, costs, security and legal flags, a debt log and a "what not to do" list.
- **Home-PC hosting assessment (S8a)**, from the owner's plan to run a 10 to 50 player server on their own PC: verdict feasible with conditions; estimated CPU, upload, memory and latency for 50 players; requirements (outbound tunnel instead of open ports, limited user, scheduled uptime, tested backups, wired network); electricity cost compared with a VPS; the triggers for moving to a VPS (S8b). All figures are estimates until measured in S3 and S6.
- **`tools/loadtest.mjs` planned (S6)**: bot clients to measure the 10, 25 and 50 player capacity of the chosen host. A 50-player scale test is now part of the V2.0.0.00 gate (S9).
- **Desktop build plan (S10)**: answer to "can the game be an exe?". Yes. Options compared (Electron recommended, Tauri, NW.js, installed web app), steps, gotchas (saves do not move between browser and exe until S5, unsigned-app warnings, an exe does not stop cheating) and a done-when. The wrapper lives in its own `desktop/` folder so the repository root stays dependency-free.
- **Server-ready rules** in `Claude.md` section 5b (R1 to R13) and a session-protocol step for server-path work, so every future session writes code that can later run on a server.
- **`tools/audit-server-ready.mjs`** and `tools/server-ready-baseline.json`: scans 28 simulation files for browser access, clocks, `Math.random`, `Settings`, presentation calls, input access and single-player assumptions. Fails when any count rises above the baseline. Re-measured on V1.10.0.00 and unchanged (3 browser, 6 clock, 160 random, 4 settings, 227 presentation, 6 input, 6 single-player hits): the HUD, loading and icon work added only client-side code. `--verbose`, `--strict`, `--write-baseline`.
- **`tests/graugr.test.mjs`**: six headless tests (AI modes, skill damage values, stun, dodge, deflect rate, raid flow). All pass on V1.10.0.00. `npm test` and `npm run audit` shortcuts in `package.json`.
- ROADMAP gains a "Server path" summary table, the hosting decision and the exe answer; README gains "Developer checks".

### Changed

- `VERSION` 1.10.0.00 → 1.10.0.01. `package.json` gains the `test` and `audit` scripts (still no dependencies).
- ROADMAP "Later" item 5 (desktop wrapper) now points at phase S10.

### Notes

- Nothing in the game changed. The audit measures today's code honestly: most debt is drawing and particle code inside entities and skills, and gameplay dice that use `Math.random`. Phase S1 removes it step by step.
- New finding (P13): the DOM HUD and character panel read live sim objects, and the loading screen's world dry run reads the real save through `Progression`. Client-only, so not counted by the audit; scheduled for S1g and S2.
- Approved future dependencies, named only so nobody adds others: `ws` (phase S3), `better-sqlite3` (phase S5), and, only inside `desktop/` and only after the owner approves, Electron and its packager (phase S10).

## V1.10.0.00 — Real loading, new HUD, character panel, SVG icons

### Added

- **Real loading screen.** The Training Grounds loading bar is now the weighted progress of actual tasks (`lobby/loadTasks.js`): class and skill data check, fonts, artwork, audio warm-up (`GameAudio.warmup`), a hidden-canvas renderer warm-up (ground, cylinder, particles, gradient, every icon) and a dry run of the world's data (progression save, player, skill slots). The game starts only when all tasks are done **and** `minTime` (1.2 s) has passed, after a 0.35 s "Ready" hold. Optional tasks that hang are abandoned after `timeout` (20 s for the screen, per-task limits inside the tasks) and the game still starts with placeholders. A fatal task (broken class or skill data) shows an error with **Retry** and **Back** instead of starting a broken game. The world fades in from black over 0.7 s.
- **Stamina.** `Vitals` has `stamina`, `maxStamina`, `staminaRegen` (Mage: 100 max, 8/s) and `spendStamina(n)`. Nothing spends it yet; Graugr keeps its own `stamina` field.
- **Character panel.** Click the profile circle in the HUD to open it (the game pauses; `Esc` or the circle closes it). Tabs: Info (character and specialization level with XP bars, health / mana / stamina, class, title, guild, faction, raid kills), Skills (unlocked and locked skills with key, mana cost and cooldown, button to open the skill tree), Attributes (core attributes as placeholders plus the real derived stats) and Equipment (empty slots, placeholder).
- **Status effect strip.** Icons to the right of the HUD card: Burning and Stunned (debuffs, orange) and Burn Resistance and Flame Shield (buffs, green). Each shows time or points left, a thin bar and a tooltip.
- **`ui/icons.js`**: the inline SVG icon set (`icon(name)`), 29 icons. New files: `ui/PlayerHud.js`, `ui/ProfilePanel.js`, `ui/icons.js`, `lobby/loadTasks.js`.

### Changed

- **HUD rebuilt in the DOM.** Top-left card: profile circle with the character level under it, player name, then tight, long and thin health / mana / stamina bars (176 x 10 px, values inside), then the status strip outside the card padding. The mana-cost preview on the mana bar and the red low-mana flash are kept.
- **Skills moved to the bottom-left** as circles with SVG icons, a cooldown sweep, a ring for charge / shield points / ward time, a dimming when mana is short, and a key hint below. Locked skills show a lock and the specialization level needed.
- **The character and specialization levels moved** from the bottom-left panel into the character panel. The "+N XP" flash now appears under the HUD card, and a green dot on the profile circle marks pending bonus picks.
- **All emoji and symbol glyphs replaced by SVG**: skill and bonus icons (`icon` fields now hold icon names), currencies, Home buttons, shop tiles, Genesis lanes, bell, modal close, skill tree, creator support. Debug text moved under the HUD card.
- `LOADING.training`: `minTime` 2.4 → 1.2, new `timeout` and `preload`.

### Removed

- The on-screen tutorial line ("WASD move · Mouse aim · K skill tree · Esc pause"), the "K Skill tree" hint, the canvas HP / MP / shield / ward / burning / stunned text and the canvas skill slots and progress panel (`drawSlot`, `drawLockedSlot`, `drawProgress`).

### Known limits

- Stamina is shown and regenerates but no skill spends it yet (sprint or dodge is the natural first use).
- The loading bar is quick on a fast machine because the tasks are small; it lengthens by itself when assets get heavier or the connection is slow.

## V1.9.0.00 — Graugr, mock raid, stun and projectile deflect

### Added

- **Graugr**, a melee enemy (`entities/Graugr.js`, all numbers in the `GRAUGR` constant). 25 health (regen 1/s), 50 stamina (regen 4/s). It only attacks with its arms. Smart AI with three modes:
  - **Attack**: health above 50% and stamina above 31%. Closes in and uses skills.
  - **Buy time**: stamina at 30% or less (also used for health 40-50%, which the rules left open). Keeps a gap of about 250 px, strafes, recovers, and may leap away if the player is on top of it.
  - **Retreat**: health below 40% and stamina below 5%. Runs away and stays in retreat until stamina is back above 31%.
  - It also dodges: when a fireball is about to hit, it leaps sideways out of the line (if the leap is ready and it has the stamina).
- **Skill 1, Arm Swing Barrage**: both arms spin for 10 s, 12 damage per hit, one hit per 0.5 s per target, short reach (78 px past the body). 40% of projectiles that reach the arms are batted back (the ball changes owner and flies away from Graugr). Costs 10 stamina, cooldown 35 s. Telegraph: a red ground circle fills during a 0.6 s wind-up, then a faint ring marks the reach while the arms spin.
- **Skill 2, Piercing Poke**: Graugr stops and charges for 3 s, then stretches one arm in a straight line (250 px) for 25 damage. Costs 13 stamina, cooldown 60 s. Telegraph is shown during the charge: the danger strip grows brighter toward its tip, and the aim locks at 70% of the charge (white outline) so a sidestep works.
- **Skill 3, Leap**: an instant dash of 170 px for attacking, dodging and escaping. Costs 20 stamina, cooldown 8 s. A body in the path takes 8 damage and a 1.5 s stun, and the dash stops at its edge.
- **Stun status**: a `hit` event can carry `stun: { duration }`. `StatusSystem` sets `entity.stunT` and counts it down. A stunned player cannot move or cast (yellow stars over the head, `STUNNED` text in the HUD).
- **Mock raid** in the Training Ground: the **Start Mock Raid** button (top-right) removes the training dummy and starts raid 1. Raid N spawns N + 1 Graugr. The next raid starts 4 s after the last one dies. **Stop Mock Raid** removes the enemies and brings the dummy back.
- **Enhancement**: raid N enemies are enhanced N - 1 tiers (raid 1 is base strength). Each tier adds 20% max health and 20% damage, shown as one yellow up-arrow per tier above the name (above 5 tiers: one arrow and `xN`).
- **Kill count** and **one-shot kill count** (an enemy that dies from the first damage it ever takes) in a panel under the top-right panel. They reset when a new raid session starts.
- New files: `entities/Graugr.js`, `systems/RaidSystem.js`, `render/drawEnhance.js`, `render/drawStun.js`.

### Changed

- `FireballProjectile.checkHit` asks entities with `deflecting` (`tryDeflect`) before the shield and body checks.
- `StatusSystem` also handles stun. `Entity` has a new `stunT` field. `Player` honours it.
- `WorldScene`: raid button, raid and kill panels, `pushBanner`, `removeDummy`, `restoreDummy`. `world.dummy` can now be `null` during a raid; `AudioSystem.casters()` was made null-safe.
- The new `kill` event (Graugr emits it) and `stun` event. `HitEvent.stun` added to `types.js`.
- `VERSION` is `1.9.0.00`.

### Notes

- Graugr's Barrage ticks are sent as `aoe` hits so repeated ticks do not stack hit-stop and shake.
- A deflected fireball keeps its burn offer, so it can ignite the player.
- Graugr has no sounds of its own yet; it uses the existing hit, hurt and down sounds.
- The leap cannot be used while retreating or buying time at low stamina (it needs 20 stamina and those modes start at 15 or less). It is used to attack, to dodge, and to escape when health is 40-50% with stamina to spare.

## V1.8.0.00 — Lobby art: Home scenery, Mode Select video, mode cards, training loading art

### Added

- **Art assets** in a new `assets/` folder: `home/scenery.webp`, `modes/select-bg.webm` + `select-bg.mp4`, `modes/live.webp`, `modes/campaign.webp`, `modes/training.webp`, `loading/training.webp` (about 1 MB in total).
- **Home scenery** replaces the drawn placeholder (fades in once loaded). The character is still a placeholder cylinder.
- **Mode Select video**: muted looping background drawn on the canvas, darkened in the centre for readability. WebM first, MP4 for Safari. The video was loaded on Home so it starts instantly, and it pauses when the scene exits.
- **Mode card pictures** for Live Server, Campaign and Training Grounds.
- **Training loading art** behind the rune rings (reuses the Training Grounds picture).
- New files: `lobby/assets.js` (lazy `loadImage` / `loadVideo`, cached, resolve `null` on failure), `render/drawCover.js` (cover-fit drawing).

### Changed

- Art paths are data in `lobbyData.js` (`ART`, `MODES[].pic`, `LOADING[].image`). If a file is missing or a format is unsupported, the scene keeps its drawn placeholder; no errors are thrown.
- The video was converted from the supplied 640x360 clip: audio removed and a 1-second crossfade added so it loops seamlessly (9 s).
- `VERSION` is `1.8.0.00`.

### Notes

- The supplied files were named the other way round (`Home-scenery.mp4` is the Mode Select video, `ModeSelectVideo.jpg` is the Home scenery). They are used by content, not by name.
- The video is 640x360 and is scaled up; a 1280x720 or 1920x1080 export from Flow would look sharper.

## V1.7.0.00 — Lobby menus: Home, Mode Select, loading screen, Creator Support

### Added

- **New title menu:** Play, Creator Support, Exit.
- **Creator Support scene** (placeholder): Monetary Support and Idea Support cards.
- **Home scene** (PUBG-style lobby, all placeholders): profile circle (top-left; click opens name, Gmail, ID and more fields), currency line (Gold, Crystals, Points) and a bell for messages (top-right), Shop panel under the currency line, Genesis Path (season pass, Starlight-style) under the Shop, big Play button bottom-left, bottom row Inventory / Character / Season Info / Rank / Settings, and a placeholder character and scenery on the canvas.
- **Shop** (click the panel): expands into a modal with the same currency line on top (shared `Wallet`), category tabs and cosmetic item cards. Buying is a placeholder.
- **Mode Select scene** (Play): Live Server, Campaign, Training Grounds. Each card has a picture placeholder; hovering shows the mode definition and stat placeholders (server, starting point, current players...). Video placeholder background that tints per mode.
- **Loading scene**: custom loading screen for Training Grounds (rune rings, progress bar, rotating tips, art placeholder). Driven by `LOADING` data; add one entry per destination.
- New files: `HomeScene`, `ModeSelectScene`, `LoadingScene`, `CreatorSupportScene`, `lobby/lobbyData.js`, `lobby/Wallet.js`, `ui/Modal.js`.

### Changed

- **Settings** moved from the title menu to the Home bottom row; its Back button returns to Home.
- Campaign / Live Server placeholders return to Mode Select (`PlaceholderScene` takes `back`).
- The in-game pause menu button now reads **Home** and returns to the Home scene.
- Training Ground is reached through Play, Mode Select and the loading screen instead of a title-menu button.
- `#ui` overlay now stretches full screen (`.panel` stays centred); menu click sound also covers the new lobby controls.
- `VERSION` is `1.7.0.00`.

### Notes

- All lobby content is placeholder data in `src/lobby/lobbyData.js`. Wallet is in-memory (not saved). Profile, Genesis Path, Rank and Season are display-only.
- Roadmap now lists the lobby development path for future sessions.

## V1.6.0.00 — Experience, specialization tree and projectile clash

### Added

- **Experience system** with two separate tracks (`Progression`): character level (cap 50) and class specialization level (cap 10). Damage you deal earns both; defeating the hostile dummy gives +50 character XP; casting Fireball gives a little specialization XP. XP bars bottom-left with a `+N XP` flash; level-ups show a banner, a ring of sparks and a jingle. Progress is saved in `localStorage` (versioned).
- **Class specialization tree** (press `K`): Mage / fire. You now start with **Fireball only**. Specialization level 5 unlocks **Flame Shield**, level 10 unlocks **Burn Resistance**. Levels 2-4 and 6-9 each grant one bonus pick from: +max mana (+10), +mana regen (+0.25/s), -cast time (5%), -skill cooldown (5%), +element damage (5%), +skill damage (5%). Locked skills show as greyed slots on the HUD.
- **Projectile collision.** Fireballs from different owners that touch explode. A stronger charge destroys a weaker one and keeps flying, weakened (full vs half: damage x0.8, size x0.875); charges within 0.12 of each other annihilate each other. The explosion (radius 70-190 px, 6-24 damage at the centre, falling to 30% at the edge) damages every nearby entity, including the caster. New files: `ProjectileClash`, `ExplosionSystem`, `ExplosionFx`; new `explosion` event and sound.
- **Dummy uses skills** setting. The hostile dummy can raise Flame Shield when threatened and cast Burn Resistance.
- **Menu:** Campaign (placeholder), Training Ground (the previous "Start"), Live Server (placeholder). New `PlaceholderScene`.
- **Cast timer debug** (Settings → Show cast timer): elapsed / total cast time above the player while charging.
- **Developer options** in Settings: test panel to add character XP, add specialization XP, jump to the next specialization level, or reset progression.
- New files: `Progression`, `SpecBonuses`, `Mods`, `XpSystem`, `SkillTreePanel`, `PlaceholderScene`.
- Skill system: `SkillCaster.addSkill / has / chargingSlot`, per-slot `cdMax` and `need` (effective cast time); `SkillDef.element`; `ClassDef.specialization`; `CasterOwner.mods`; `HitEvent.aoe`. See `src/types.js`.

### Changed

- The Mage no longer starts with all three skills (see the specialization tree). Existing play-throughs start at specialization level 1.
- Cast time and cooldown go through the owner's modifiers (`mods.castTimeMult`, `mods.cooldownMult`). HUD cooldown overlay uses the real (shortened) cooldown.
- The hostile dummy only owns the first class skill unless **Dummy uses skills** is on. A defeated dummy drops its Flame Shield.
- Settings panel scrolls when taller than the window.
- HUD controls line shortened; each skill slot shows its own key hint.

### Notes

- "-Skill CC" in the design notes was implemented as **skill cooldown**. If crowd control or casting cost was meant, change the `cooldown` entry in `SpecBonuses.js`.

## V1.5.0.00 — Burn and Burn Resistance

### Added

- **Burn status effect.** Fireball body hits can set the target on fire: 20% chance at minimum charge up to 50% at full charge, lasting 5 to 10 seconds, 8 damage per second applied as one tick per second. Works on the player and the dummy.
  - Fire particles rise from the burning body with a flickering light; in the last 1.2 seconds the fire shrinks and thins out, then a puff of smoke drifts off.
  - Every tick plays a sound, flashes and lights up the body, shows an orange damage number and throws sparks. The dummy counts burn damage in Total damage and DPS but not in Hits.
  - Re-igniting refreshes the timer instead of stacking. A burn ends when the target is downed.
- **Burn Resistance** skill (third Mage skill, `Q`, hold): self-only buff with a 1.2 s cast time and 25 mana cost.
  - Casting: red-orange magic circle on the ground, motes rising and spiralling in, red-orange body glow. Releasing early cancels for free. Fires automatically when the circle completes.
  - Active for 30 seconds: red-orange glow, rising embers and a trail of glowing particles while moving. On expiry the glow fades and leaves hanging embers behind.
  - Fire skill damage taken -30%. Burn ticks do 50% damage. When a burn ignites there is a 50% chance the ward nullifies it: the burn is cancelled, the ward is consumed, a red-orange toast above the target shows a burn icon being slashed in two, and a slash-and-hiss sound plays.
  - HUD: third skill slot, ward time-left bar, BURNING line with time and damage per second.
- Sounds: ignite, burn tick, burn nullified, ward up, ward down (`GameAudio.burnIgnite / burnTick / burnNullify / wardUp / wardDown`).
- New files: `StatusSystem`, `BurnFx`, `Toasts`, `BurnResistance`, `BurnWardEffect`, `drawAura`.
- Skill system: `SkillDef.autoRelease` (cast-time skills), `SkillDef.self` (caster-only skills), `SkillDef.palette` (magic circle colours); `SkillCaster.chargingSkill`.
- Events: `burn` and `ward` on the world bus; `HitEvent.burn` and `HitEvent.resisted`; `onDot(e)` entity hook; `Entity.burn` and `Entity.ward`. See `src/types.js`.

### Changed

- Fireball damage is now rounded to whole numbers. Damage numbers could show long decimals (for example `9.773225110080318`) because the rolled damage was never rounded.
- `drawCylinder` accepts an optional `tint`. `ParticleSystem.js` exports `quality()` for per-second emit rates.
- Skill slots on the HUD are spaced wider and long skill names shrink to fit.
- The hostile dummy's `wantsCast` ignores `self` skills, so it does not start charging Burn Resistance.

## V1.4.0.00 — Magic circle casting and Flame Shield

### Added

- **Magic circle casting.** While charging Fireball, a rune circle forms under the caster and a second circle hovers in front of the caster facing the aim direction. Runes light up one by one as the charge rises, the outer ring sweeps with the charge, triangles and rings counter-rotate, rune motes lift off the ground, and the circle discharges in a ring of sparks on release. The hostile dummy uses the same visuals.
- **Flame Shield** skill (new Mage skill): a flame arc (115 degrees, 56 px from the caster) that follows the aim direction. Press `Right Mouse` or `E` to raise, press again to drop.
  - 50 shield points. Damage below the points is absorbed and subtracted. Damage equal to the points breaks the shield with nothing passing through. Greater damage breaks the shield and the remainder continues, shrinking the projectile, and hits the body.
  - Costs 10 mana to cast and 5 mana per second to maintain. The shield collapses when mana runs out or the caster is downed.
  - One shield per caster. Shots from behind are not blocked, and your own shots pass through.
  - HUD: second skill slot, shield point bar under the mana bar, absorbed damage shown as amber numbers.
  - Procedural sounds for raise, hit, break and drop (`GameAudio.shieldUp / shieldHit / shieldBreak / shieldDown`).
- **Toggle skills** in the skill system: `SkillDef.toggle` with `isActive`, `onActivate`, `onDeactivate`; casters may implement `wantsToggle`.
- New `shield` event on the world bus, new `ShieldEvent` and `SkillDef` fields in `src/types.js`.

### Changed

- `FireballProjectile` rolls its damage once (`roll()`), so a shield and the body see the same number.
- The HUD draws every skill slot of the class instead of only the first.

## V1.3.0.00 — Moving dummy

### Added

- Setting **Dummy movement** (Stationary, Patrol, Strafe), applied on Start. Persisted in `localStorage` as `dummyMovement`.
- Patrol: the dummy follows a sine path along a 520 px line through its home point.
- Strafe: the dummy circles the player at 340 px and reverses direction every 3 to 6 seconds. Works in both passive and hostile mode.
- The dummy leans into its direction of travel. Movement pauses during hit-freeze and hit knock-back still applies.

### Changed

- The home-spring that pulls the dummy back to its start point now applies only in Stationary mode. In moving modes the steering target replaces it.

## V1.2.0.01 — Cleanup

### Changed

- Particle-count helper (`scaled`) now lives in `ParticleSystem.js`; removed three duplicate copies.

### Removed

- Unused `rgba` import in `Lights.js`, unused `mid` parameter in `HitEffects.shockwaves`, redundant `this.game` assignment in `WorldScene`.

### Added

- `src/types.js`: JSDoc contracts for skills, classes, casters, hit and cast events.
- Type annotations on `Fireball`, `Mage`, `Entity`, `SkillCaster`, `HitEffects.onHit`.

## V1.2.0.00 — Audio

### Added

- Procedural audio engine (Web Audio API): charge hum, cast whoosh, impact, hurt, no-mana dud, death, respawn, menu click.
- Positional audio: distance attenuation and stereo pan for the hostile dummy.
- Master volume setting is now functional, with a preview sound.
- `AudioSystem` bridges game events to sounds; new `cast` event emitted on skill release.
- Audio mutes when the tab is hidden and the charge hum stops on pause.

## V1.0.0.00 — Primordia MVP

### Added

- Main menu (Start, Settings, Exit Game), settings screen with persistence, pause menu.
- Mage character (cylinder) with WASD movement, mouse aim.
- Fireball skill: charge, recoil, trail, glow, physics particles, burst behind target, hit-freeze, hit light, falling damage numbers.
- Training dummy with infinite health and live stats (total, hits, last, 5s DPS).
- Architecture: scene manager, event bus, registries, skill caster, particle/light/camera systems.

## V1.1.0.00 — Vitals and hostile dummy

### Added

- Player health (max 50, regen 0.1/s) and mana (max 100, regen 1/s), HUD bars, death and respawn.
- Fireball mana cost scaling from 5 (min charge) to 20 (full charge); charge is capped by available mana; cost preview on the mana bar.
- Settings toggle "Dummy attacks": the dummy uses the player's stats, casts fireballs at the player, can be defeated.

### Changed

- Fireball damage rebalanced to 8–30 for 50 HP characters.
- SkillCaster now asks the owner `wantsCast()`, so any entity (player, enemy) can cast skills.
