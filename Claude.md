# CLAUDE.md: Lycarius MMORPG: Primordia

Read first, every session. Keep it short (it is loaded each time). Update it when a rule changes.

## 1. Snapshot

- 2D open-world MMORPG (adventure / RPG / management). Edition 1 = **Primordia**; edition 2 = **Proto** (later, separate).
- Stack: HTML5 Canvas + vanilla JS ES modules. No bundler, deps or build step. Run with VS Code Live Server on `index.html` (modules need http).
- Version: `VERSION` in `src/config.js`. History `CHANGELOG.md`, plan `ROADMAP.md`, full docs `README.md`.
- Pseudo-3D: characters are cylinders; entities have ground `(x,y)` + height `z`, drawn at `y - z`. Ground rings are drawn squashed (0.5) but hit tests are circles in `(x,y)`.
- Long-term: factions, guild wars, branching story, real-party missions, server-authoritative multiplayer (V2). **Road to online: `SERVER_PATH.md` (incl. hosting on the owner's own PC and the optional exe build); code server-ready from now on (section 5b).**

## 1b. Doc map (open a section, never a whole doc)

`node tools/sec.mjs <file>` lists headings; `node tools/sec.mjs <file> <id|text>` prints one section (`5b`, `S1f`, `M2`, `G2`, `V1.9.0.00`, `Burn Resistance`). `npm run docs` checks that every doc keeps this structure.

| File | Open when | Sections |
| ---- | --------- | -------- |
| `Claude.md` | every session | 1 snapshot, 2 protocol, 3 git, 4 code map, 5/5b rules, 6 perf, 7 GitHub, 8 done, 9 gotchas |
| `ROADMAP.md` | **user does not know what to work on**, choosing or planning work | **Choosing work**, Done, Server path, **Proposals**, Lobby path, combat depth, art and maps, world, Later |
| `docs/MMORPG_GUIDELINE.md` | after picking work from the roadmap, for ideas and risks on the same topic (a guide, never the truth) | G0 use, G1 shared data, G2 server loop, G3 rendering, G4 sessions and saves, G5 entities and combat, G6 AI rules, G7 load tests, G8 conflicts, G9 order |
| `SERVER_PATH.md` | any server-path work | 0 gates, 1 decisions, 2 audit, S1..S10 (`S1f`), 4 cost, 5 flags, 6 debt, 7 not-to-do, 8 proposal hooks |
| `docs/ENGINES_AND_SYSTEMS.md` | **creating, planning or reviewing any system or engine** (loop, transport, registry, saves, spatial grid, pipeline): find its row, Status and Where first. A guideline, not the truth | E0 use, E1 early, E2 mid, E3 scale, E4 differences, E5 checklist |
| `docs/proposals/ASSESSMENT.md` | any M or W work, **first** | 1 verdicts, 2 findings, 3-4 Marble plan, 5-6 World plan, 7 risks, 8 rules |
| `docs/proposals/Marble-bag-engine.md` | randomness, crit, loot, gates, hidden or item-instance state, crafting secrets, NPC memory, discoveries | 1 goal, 3 config, 4 bags, 5 gates, 6 bow, 7 data, 8 state/security, 9 archive, 10 parts, 11 tests, 12 phases, 13 laws |
| `docs/proposals/World-Division-and-Lag-Management.md` | zones, maps, instances, rooms, spatial cells, interest management, NPC population or tiers, tick budget, load or lag | 2 hierarchy, 4 cells, 5 tiers, 6 NPCs, 7 loop, 8 net, 9 capacity, 10 persistence, 11 metrics, 12 tests, 13 phases, 14 rules |
| `docs/proposals/Inventory-and-ownership.md` | items, inventory, ownership, equipment, Home Inventory, Shop purchases, wallet, rewards (L2 to L5) | 1 terms, 2 audit, 3 boundaries, 4 model, 5 phases A-I, 6 Home, 7 Character, 8 related, 9 saves and security, 10 checks, 11 decisions, 13 adoption record and phase status |
| `docs/ART_AND_MAPS.md` | sprites, animation, tiles, maps, camera scale, pixel rendering, Tiled | 1 decisions, 2 pixel rules, 3 track A, 4 track T, 5 map format, 6 Tiled setup, 7 risks |
| `README.md` | player-facing docs of a feature | one heading per feature, 4 architecture, 4b checks |
| `CHANGELOG.md` | what shipped in a version | one heading per `V<x.y.z.nn>` |

## 2. Session protocol (save tokens)

1. **Start:** read this file. Do **not** ask for or unzip the whole repo for a small task, and read docs by section (1b). Use the code map (section 4) to name the 3-8 files needed. If the user attached a full zip, unzip once, then `grep -n` / `view_range`; never `cat` big files.
2. **Work in a copy.** Source files are **CRLF**. Read with `tr -d '\r'`; edit in LF with exact-match replace (assert one match); convert back to CRLF before packaging (`sed -i 's/$/\r/'`). Never leave mixed endings.
3. **Verify before delivering:** run `node tests/graugr.test.mjs`, `node tests/mage.test.mjs`, `node tests/fireblast.test.mjs`, `node tests/abilities.test.mjs`, `node tests/rng.test.mjs`, `node tests/clock.test.mjs`, `node tests/damage.test.mjs`, `node tests/input.test.mjs`, `node tests/projectile-view.test.mjs`, `node tests/storage.test.mjs`, `node tests/items.test.mjs` (or `npm test`) and `node tools/audit-server-ready.mjs` (all must pass), `node --check` on every `src/**/*.js`; for new logic, a tiny headless harness (stub `world` with `events`, `entities`, `player`, `particles`, `damageNumbers`, `lights`) run with `node`. For drawing, call `draw` with a Proxy ctx and assert no NaN args. State what was and was not tested (browser play is the user's test).
4. **Deliver a changes-only zip**, never the whole repo: `lycarius-primordia-V<x.y.z.nn>-changes.zip`, paths relative to the repo root (`src/...`, `css/...`, docs), CRLF kept, only new + changed files, docs and `Claude.md` included. List the files in chat. User extracts into the repo root and overwrites. Make the zip with python `zipfile`, forward slashes.
5. **Chat reply, in order:** design decisions with numbers (only the non-obvious ones, flag ambiguities and the default taken) → what changed (file list) → **Server-ready: yes, or debt (file: what)** → test checklist (concrete, observable) → GitHub steps (exact commands, section 7) → known difficulties. No code dumps in chat unless the user asks.
6. **Ask at most one question**, only if blocked or at a real roadmap fork. Do not bundle unrequested features. Bugs: cause in 1-2 lines, then the fix as the next FIX version.
7. **Server-path work:** read `SERVER_PATH.md` section 0, section 1 and only the phase being built. One phase (or one S1 step) per version; follow its "Done when" literally. Do not start a phase whose predecessor's gates are not green. The exe (S10) and hosting (S8) are planned only; add no dependency or `desktop/` folder without the owner's approval.
8. **Proposal work (Marble Bag Engine M, World Division W):** if a task touches random outcomes or crit, loot, item or hidden state, gates, crafting secrets, zones or maps, instances, rooms, spatial queries, interest management, NPC population or AI tiers, tick budget, load or lag: first open `docs/proposals/ASSESSMENT.md` section 1 and the stage section (3-4 or 5-6), then only the proposal sections it names. The proposals are **not code**: verify in the repo, claim nothing without tests, one stage per version, owner approves each stage, start a stage only when its Needs are green (ROADMAP "Proposals"; hooks in `SERVER_PATH.md` section 8). Where a proposal conflicts with this file, `SERVER_PATH.md` or a decision in the assessment, the proposal loses; flag it.
9. If the chat gets long, end with a <10 line state summary (version, branch, last change, next step).
10. **The user does not know what to work on** (or says "what next", "continue", "you decide"): do this, in order, and do not ask an open question.
    1. `node tools/sec.mjs ROADMAP.md "Choosing work"` and follow it: it lists the unblocked candidates and a default.
    2. Verify the pick's `Needs` are green (`SERVER_PATH.md` section 0, `ASSESSMENT.md` section 1 for M and W items). Pick at most 3 candidates, recommend one, ask at most one question (rule 6), or start the recommended one if the user said to decide.
    3. Before building, read the matching section of `docs/MMORPG_GUIDELINE.md` (`G1`-`G7`). It is **a guide, not the absolute truth**: its evidence is mostly unmeasured, so verify claims in the repo or with a test, and where it conflicts with this file, `SERVER_PATH.md` or the assessment, it loses (G0, G8). Flag the conflict in one line.
11. **Systems and engines:** before creating, planning or reviewing one, open `docs/ENGINES_AND_SYSTEMS.md` E0 and the row in E1-E3, and run its E5 checklist. It is **a guideline, not the absolute truth**: where it conflicts with this file, `SERVER_PATH.md` or the assessment, it loses (flag it in E4). Update its `Status` when a system ships.
12. **Doc structure (every doc, every edit):** a `#` title, numbered `##` sections with stable ids, one topic per section, sections of at most 60 lines (split or add `###` above that), tables and lists over long paragraphs, and a doc-map row here when a doc is added. New or changed docs must pass `npm run docs`. Source files: keep the code map (section 4) current, one purpose per file, short header comment saying what the file is for.

## 3. Versioning and git

`V<MAJOR>.<MINOR>.<FIX>.<CLEANUP>` (cleanup is two digits). MAJOR = new edition / huge system; MINOR = feature / content; FIX = bug or balance; CLEANUP = refactor, format, docs. A bump resets the digits to its right. Bump `config.js` + CHANGELOG + README + ROADMAP + git tag together. Docs are public and meticulous: full prose, never skipped.

Commits (Conventional): `feat` → minor, `fix` → fix, `chore/refactor/docs/style` → cleanup. Branches: `main` stable + tags only, `dev` integration, work on `feature/*`, `fix/*`, `cleanup/*` from `dev`. Code and docs in separate commits. In `git add`, **list files explicitly** (a plain `git add .` can pick up line-ending noise).

## 4. Code map (read this instead of opening files)

```
main.js            bootstrap: settings, scenes, audio unlock, loop
config.js          GAME_NAME, EDITION, VERSION
types.js           JSDoc: SkillDef, ClassDef, CasterOwner, HitEvent (+burn, stun), CastEvent, ExplosionEvent
content/index.js   ONE manifest: register skills, classes, spec bonuses
core/              Game (loop, goto(name,params) clears #ui), Scene, Input (isDown/wasPressed, mouse), EventBus (on/off/emit), LocalStorageAdapter (CLIENT ONLY: `createLocalStorageAdapter(key)`, `PROGRESS_KEY`),
                   Registry, Settings (DEFAULTS keys), math (clamp lerp rand [visual only] dist lerpColor rgba hash2 TAU)
input/             PlayerController (CLIENT ONLY: keys + mouse + camera -> `player.applyCommand({seq,mx,my,aim,btn})` once per frame; the only code that maps keys to skills)
sim/               items/ (ItemRegistry: `defineItem` validates, freezes and registers, `findItem` / `hasItem` safe lookup, `allItems` by id, enums; cosmetics.js: the nine account-owned cosmetics; definitions only, no ownership); storage.js (storage adapter contract `load()`/`save(data)` + `createMemoryStorage`; sim code gets storage only through it); InputCommand.js (`idleCommand`, `sanitizeCommand`, `MAX_SLOTS`, `BTN_MASK`: the command shape and its R11 validation); rng.js: Rng (mulberry32: next, range(a,b), chance(p), state, setState), created as `world.rng`; the only source of gameplay dice
scenes/            Menu, Home, ModeSelect, Loading, CreatorSupport, Settings, Exit, Placeholder (campaign, live), World
  WorldScene       THE game scene = `world` object. enter() builds systems in order; update(); render(); canvas HUD (drawHud, drawRaidPanel,
                   drawKillPanel, drawBanners); DOM HUD = `hud` (PlayerHud) + `profile` (ProfilePanel); spawn(), hitstop(), pushBanner(),
                   removeDummy()/restoreDummy(), openTree/openProfile (pause the game), buildPauseMenu(), buildRaidButton(); fields: rng + seed (gameplay dice; `new WorldScene({seed})`), time (sim clock, seconds), player,
                   dummy (can be null in a raid), raid, entities, events, particles, lights, damageNumbers, camera, audio, progression, banners
lobby/             lobbyData (content + art paths), Wallet, assets (lazy loaders), loadTasks (loading-screen readiness tasks: buildTasks)
entities/          Entity (x y z radius height dead kind hittable solid burn ward stunT; hooks onHit onDot),
                   Player (stats, syncProgression, stun-aware, downed/respawn), TrainingDummy (passive/hostile, thinkSkills),
                   Graugr (melee enemy; GRAUGR consts; AI pickMode/think/dodge; startBarrage/startPoke/leap; tryDeflect; emits 'kill')
classes/           ClassRegistry, Mage (data), Universal (skills every class gets: dodge)
skills/            SkillRegistry; defs Fireball FlameShield BurnResistance FireBlast (self AOE, `noAi`, emits `blast` + aoe `hit`s) ManaRegen Dodge (`instant: true` = one press, no charge; `canUse`/`onDenied` for stamina); ManaRegenEffect (sim only, sets `vitals.manaRegenMult`); FireballProjectile (SIM ONLY since V1.12.0.05: `kind = "fireball"`, emits `projectile:fizzle`; checkHit order: clash → deflect →
                   shield → body; roll(); hit()), FlameShieldEffect, BurnWardEffect, ProjectileClash
progression/       Progression(cls, storage) (XP, levels, picks, versioned save through the adapter; no browser API), SpecBonuses (data), Mods (skillMult, elementMult)
ui/                PlayerHud (top-left card, status icons, bottom-left skill circles), ProfilePanel (character panel), SkillTreePanel,
                   SettingsPanel (SECTIONS rows; staged edit: live preview, Save persists, Back asks Save/Discard; ctx home|game), Modal (openModal), icons (`icon(name)` SVG set; skills / bonuses store the icon NAME)
systems/           pipeline (SIM_SYSTEMS then VIEW_SYSTEMS: the one ordered list, `createSystems` / `disposeSystems`), DamageSystem (sim: `hit` -> `target.onHit`), SkillCaster (casters: vitals aim getCastOrigin wantsCast applyImpulse kick lowManaFlash), Vitals (hp/mana/stamina),
                   HitEffects (view: 'hit' → flash, glow, hit-stop, shake, numbers, sparks; never changes sim state), StatusSystem (burn + stun), ExplosionSystem, XpSystem,
                   RaidSystem (start/stop/nextRaid/update; kills, oneShots), ParticleSystem (emit; `scaled as n`), Lights, Camera,
                   DamageNumbers.spawn(x,y,text,{crit,color}), Toasts, BurnFx, ExplosionFx, BlastFx (Fire Blast visuals), ManaRegenFx (bubbles, 'manaRegen'), DodgeFx (yellow trail, 'dodge'), AudioSystem (events → GameAudio)
audio/AudioEngine  procedural Web Audio, no asset files
view/              CLIENT ONLY (S1f): index.js (the ONE manifest `VIEWS = { kind: ViewClass }`), EntityViews (system `world.entityViews`: `update(dt)` ticks the views of the entities that just ran, `draw(ctx,e)` draws by `e.kind`, falls back to `e.draw`), FireballView (trail, embers, smoke, light, fizzle burst, draw; per-ball state in a WeakMap). A view class takes `(world)` and has `tick(e,dt)`, `draw(ctx,e)`, `dispose()`
render/            drawCylinder drawGlow drawGround drawBar drawChargeOrb drawMagicCircle drawAura drawRibbons drawCover drawEnhance drawStun
tools/             audit-server-ready.mjs (+ server-ready-baseline.json): counts sim-code debt, fails on increase; sec.mjs: print one doc section
docs/proposals/    ASSESSMENT + the two proposals (Marble bag, World division); design only, no code
docs/ART_AND_MAPS.md  art style, sprite manifest, Tiled maps; plan only
tests/             graugr.test.mjs (Graugr, raid, stun, deflect), mage.test.mjs (S1a safety net: Mage kit, burn, shield, explosions, clash, XP and levels), helpers.mjs (stub world with a seeded `rng` and `time`, step (advances `w.time`), capture, ScriptedRng, withRng, dice, createMemoryStorage; pattern for new tests) fireblast.test.mjs (Fire Blast), abilities.test.mjs (Mana Regen, Dodge), rng.test.mjs (S1b: Rng, same-seed fights, Math.random independence), clock.test.mjs (S1c: `world.time`, dummy DPS window), input.test.mjs (S1e: InputCommand validation, scripted commands drive Player, PlayerController), damage.test.mjs (S1d: DamageSystem, no HitEffects, flash and glow from events, same fight with and without the view), visuals-settings.test.mjs (particle shapes, ribbons, staged Settings), projectile-view.test.mjs (S1f-a: fireball sim with throwing presentation stubs, FireballView, EntityViews, pipeline and scene wiring), storage.test.mjs (S1g: memory and localStorage adapters, no browser API in Progression), items.test.mjs (L2: definition validation, registry, cosmetics, Shop guard)
```

World events: `hit` `cast` `explosion` `blast` `burn` `ward` `shield` `levelup` `kill` `stun` `manaRegen` `dodge`. HitEvent: `{source,target,damage,crit,dir,charge,x,y,z,aoe?,burn?,stun?}`.

## 5. Architecture rules

1. **Data over code.** Classes, skills (later items, quests) are definition objects registered in `content/index.js`.
2. **Events over calls.** Combat emits; VFX, audio, UI, quests subscribe. Never call audio/VFX from combat logic.
3. **Any entity can cast** through `SkillCaster` + the `CasterOwner` shape. Melee enemies (Graugr) run their own small state machine instead.
4. Entities extend `Entity`; optional `hittable`, `solid`, `onHit(e)`, `onDot(e)`, `damageColor`. Scenes extend `Scene`, call `super.enter(game)`, register via `game.register`; they talk via `game.goto`, never by importing each other.
5. Settings: default in `Settings.js` + one row in `SECTIONS` of `ui/SettingsPanel.js` (`ctx:"game"` for dummy / developer items; the lobby shows player preferences only). Shared helpers live once (`scaled as n` for particle counts).
6. Annotate new skills/classes/events with `@type {import('../types.js').X}`. No dependency or bundler without approval and a roadmap entry.
7. **Art:** semi-pixelated (D12). Before touching sprites, tiles, manifests, camera scale or maps, open `docs/ART_AND_MAPS.md` sections 1 and 2 plus the stage. 32 px tiles, 32x48 px frames, integer scale, smoothing off for sprites/tiles only; missing art falls back to the cylinder; map collision is sim code (server-ready).
8. New features are additions, not edits. Keep damage integers. Constants for tuning go at the top of the file.

## 5b. Server-ready rules (MANDATORY; the plan and phases are in `SERVER_PATH.md`)

Goal: all gameplay code must later run **unchanged** on a headless Node server that is the only authority. These rules apply to every new or edited line of **simulation code**: `entities/ skills/ classes/ progression/ content/ sim/`, `systems/{Vitals,SkillCaster,StatusSystem,ExplosionSystem,XpSystem,RaidSystem}`, `core/{EventBus,Registry,math}` (the exact list is in `tools/audit-server-ready.mjs`).

1. **R1 No browser in the sim:** no `document window navigator localStorage Audio*`, no canvas `ctx`, no `Settings`.
2. **R2 No clock in the sim:** no `performance.now Date.now setTimeout setInterval requestAnimationFrame`. A timer is a number decremented by `dt`; "how long ago" is `world.time` (seconds, since S1c, V1.12.0.02), which advances once per sim step with the entities' `dt`. Draw code may still read `performance.now` until S1f.
3. **R3 Gameplay randomness** (damage, crit, chances, AI choices, spawn positions) goes through `world.rng` (`next()`, `range(a,b)`, `chance(p)`; exists since S1b, V1.11.2.01), never `Math.random` or `rand()`. A constructor that rolls takes an optional `{ rng }` and uses a fixed fallback without it; runtime code reads `world.rng`. Keep rolls in a function named `roll*` / `pick*`, never call it from drawing code, never at module load. `rand()` is for visuals only (particles, shake, audio) until S1f moves them out.
4. **R4 Input:** the sim reads only a per-entity command object (`entity.cmd`, an `InputCommand { seq, mx, my, aim, btn }` from `sim/InputCommand.js`; done in S1e, V1.12.0.04). Never read `world.input`, `world.camera` or `world.game` in sim code. A new controllable entity gets `applyCommand(raw)` (it validates through `sanitizeCommand`) and reads `this.cmd`; a client-only controller in `src/input/` fills it.
5. **R5 Presentation:** the sim emits events with plain data. It never calls `particles / lights / damageNumbers / camera / hitstop / audio`. New effects = a listener that draws, not a call from logic.
6. **R6 Authority:** health, stamina, mana, status, position and cooldowns change only inside sim code (own `update` or an event). Views never write sim state. Cost and cooldown checks live in the sim, never only in the UI.
7. **R7 Players are plural:** never write a new `world.player`. Take the target as a parameter or find the nearest in one helper.
8. **R8 Plain data:** sim state is numbers, strings, booleans, arrays and objects of those, plus **ids** of other entities. Each entity's header comment lists the fields clients would need (replicated fields). Events carry plain data only.
9. **R9 Order independence:** no result may depend on `Map` / `Set` / object-key order or on one system being created "after" another. Iterate arrays; break ties by `id`.
10. **R10 Frame-rate independence:** no per-frame counters; use `dt`. Hit-stop and screen shake must never change sim outcomes.
11. **R11 Untrusted input:** any value that can come from a client has its allowed range as a constant at the top of the file and is validated at the boundary.
12. **R12 Node-importable:** a sim file must import in Node with no globals defined. Check it in your headless test (no `window` / `document` stubs).
13. **R13 Dependencies** only as approved in `SERVER_PATH.md` (`ws` in S3, `better-sqlite3` in S5; Electron only inside `desktop/` in S10, after the owner approves).

**Gate:** `node tools/audit-server-ready.mjs` must print `PASS`. A **new file must have zero hits** (it is not in the baseline). If a rule truly cannot be met, add one line to the debt log (`SERVER_PATH.md` section 6) and say so in the reply. When you reduce debt, run `--write-baseline` in the same branch. Debt never goes up. `--verbose` lists `file:line` for each hit.

## 6. Performance and tokens

- Targets: 60 FPS with 3,000+ particles, first frame < 1 s, zero external requests. Hot paths (`update`, `render`, particles): no `new`, spread, `.map/.filter/.sort` copies when an in-place loop works. Scale particle counts with `scaled()`; hard cap 6000. Cull off-screen; batch by composite mode. Measure with Settings → debug before optimizing.
- Tokens: smallest diff wins; do not re-read files already in context; do not repeat unchanged code; one tool call per file; batch independent calls; `sh` has no brace expansion (`mkdir -p a b c`). Chat: answer first, short sentences, numbers over adjectives, one recommendation. Shorthand (`→ w/ cfg impl req perf alloc ctx`) in notes only; docs stay in full prose. No emoji in code, UI or commits: use `icon(name)` from `ui/icons.js`.

## 7. GitHub steps (give these, with the real branch and version)

```
git checkout dev; git pull
git checkout -b feature/<name>
Expand-Archive -Path "$HOME\Downloads\<zip>" -DestinationPath . -Force   # from the repo root
git status                                  # only the delivered files should appear
git add <explicit file list>; git commit -m "feat(<scope>): <summary>"
git add README.md CHANGELOG.md ROADMAP.md Claude.md; git commit -m "docs: update for V<x.y.z.nn>"
git push -u origin feature/<name>
# GitHub: PR feature → dev (merge, delete branch), then PR dev → main (merge)
git checkout main; git pull
git tag -a V<x.y.z.nn> -m "V<x.y.z.nn> - <title>"; git push origin V<x.y.z.nn>
git checkout dev; git pull
```

Undo before pushing: `git restore .` (and `git clean -fd` for new files), or `git switch dev; git branch -D feature/<name>`.

## 8. Definition of done

- [ ] Works; console clean; no gameplay regression. `node --check` passes. No duplicate helpers.
- [ ] `VERSION` bumped; CHANGELOG, README, ROADMAP, this file updated if a rule or the code map changed.
- [ ] Server-ready gate (5b) passes; debt log and baseline updated if debt changed.
- [ ] `node tools/check-docs.mjs` passes (doc structure, section 2 rule 12).
- [ ] Changes-only zip, test checklist, GitHub steps delivered.

## 9. Gotchas

- Opening `index.html` directly fails (modules). Use Live Server or `npx serve .`. Audio unlocks on the first gesture. "Exit Game" cannot close a tab.
- Dummy "attacks" and "skills" settings are read when the dummy is built (world start, `restoreDummy`, and when in-game Settings saves a `dummy*` key). Dummy skills AI needs both.
- **Buff visuals have a language, never stack glows:** circles (`bubble` particles) = regen, ribbons (`drawRibbons`) = resistance, dashes (`dash` particles) = motion / haze. `drawAura` is for cast charge only.
- **Click handlers on DOM buttons that hold an icon must use `e.target.closest("[data-a]")`**; `e.target.dataset.a` misses clicks on the SVG (the V1.12.0.00 modal X bug). Text-only buttons are safe.
- `Lights` with `once:true` live one frame; re-add every update. Hit-stop scales entity `dt` to 8% and particle `dt` to 40%; real-time code uses the raw `dt`.
- Toggle skills: caster calls `isActive/onActivate/onDeactivate`; owner needs `wantsToggle(slot, world)`. Cast-time skills: `autoRelease` fires at charge 1; `self:true` skills are skipped by AI `wantsCast`.
- **Presentation by `kind` (S1f).** A class whose group is done (FireballProjectile) has no `draw`, particles, lights or `rand`: it sets `kind`, emits plain-data events, and its look is a view in `src/view/` registered in `view/index.js`. `WorldScene.update` runs `entityViews.update(edt)` after the entities update and BEFORE the dead are filtered (a ball that died this step still ticks once); `render` draws through `entityViews.draw`. A kind without a view still draws itself with `e.draw`. A new projectile kind: set `kind`, add a view, and a test with `particles`/`lights` stubs that throw (pattern: `tests/projectile-view.test.mjs`).
- Projectiles: set `isProjectile`, `owner`, `charge`, `weaken(ratio)`; skip `update` work if `dead`; call `clashProjectiles`, then the deflect loop (`e.deflecting` → `e.tryDeflect(proj, world)`), then shields (`isShield` `blocks/absorb`), then bodies. Fire projectiles call `target.ward.resist(dmg)` before emitting `hit`.
- Status: burn on `entity.burn` (ignition offered by `hit.burn`); stun on `entity.stunT` (offered by `hit.stun`, always applies, refreshes not stacks). Systems are created ONLY from the lists in `systems/pipeline.js`, sim group first: `damage` (applies `hit` through `target.onHit`) before `status` (ignition is rolled on a target the blow may just have downed) before `xp`; a new system goes in its group there. `BurnFx.update` runs after `lights.update`. Entities that can burn implement `onDot(e)`; a stunned entity must honour `stunT` itself (Player, Graugr do).
- `XpSystem` sits after `damage` and `status` in `SIM_SYSTEMS`. It pays kill XP for `downed && attack && !xpGiven`, so enemies that die set `downed = true` and `attack = true` (Graugr does).
- `world.dummy` is `null` during a mock raid. Anything touching it must use `?.` (AudioSystem does). `restoreDummy()` rebuilds it from Settings.
- Graugr: emits `kill {target, source, oneShot, tier}` on the first update after death (it has no world in `onHit`). One-shot = it died on its first damage event. Barrage ticks are `aoe` hits (no hit-stop spam). A deflected projectile gets `owner = Graugr`.
- DOM buttons over the canvas: `#ui` has `pointer-events:none`; give the control `pointer-events:auto`. A focused button reacts to Space (the fireball key), so use `tabIndex=-1` and `preventDefault` on `mousedown`.
- Player starts with Fireball only; skills come from `Progression.unlockedSkills()`; call `Player.syncProgression()` after any pick or level-up. Cast time / cooldown use `owner.mods?.castTimeMult / cooldownMult`; damage uses `skillMult` / `elementMult`.
- **Every `self` skill must carry a `palette`** (`Player.draw` and `drawAura` read it; a missing one killed the render loop in V1.11.0.00). `tests/fireblast.test.mjs` checks it and draws a full cast with the real particle, light and camera systems; copy that pattern for any new skill that draws.
- Fire Blast: self skill with `noAi:true` (TrainingDummy filters such skills out of its caster). It emits `blast`, not `cast`, so XpSystem gives no flat spec XP. Knockback = `target.applyImpulse` after the `hit` (hit `charge` kept at 0.3 so the target's own onHit knock stays small). No randomness in the file: burn chance is rolled by StatusSystem.
- **`onHit(e, world)` / `onDot(e, world)` are sim only** (health, knock, `freeze`, downing, damage totals); `DamageSystem` calls them. `flash` and `glow` are view fields written by `HitEffects` (hit: 1) and `BurnFx` (burn tick: 0.55 player, 0.8 others); entities only fade and draw them. A test world needs `DamageSystem` (or `createSystems(w, SIM_SYSTEMS)`) for hits to land; `HitEffects` is not needed. `Graugr` death still calls `world.particles` directly (debt, S1f), so stub worlds keep no-op presentation objects.
- **Input is a command (S1e).** `Player.update` reads `this.cmd` (`mx my aim btn`) and nothing else. `btn` bit i = the player's i-th caster slot is held (slot order grows as skills unlock); a toggle skill fires on the rising edge (`btnNow` set, `btnPrev` clear). `WorldScene.update` runs `controller.update(player)` before the entities. A headless test drives a player with `player.applyCommand({seq: ++n, ...})` and needs no `input`, `camera` or `game`; a test that wants key semantics builds a `PlayerController` over a stub `input` (see `tests/abilities.test.mjs`). `seq` must rise by 1 per command or the command is ignored. Aim is computed from the player's position at the start of the frame (one frame older than before S1e).
- Explosions: emit `explosion`; `ExplosionSystem` deals area damage as `hit` events with `aoe:true`.
- Clock: `world.time` is advanced in `WorldScene.update` before the entities run (`this.time += edt`: it stops in pause, slows in hit-stop); a stub world sets `w.time` itself (`step()` in `tests/helpers.mjs` does). `onHit(e, world)` and `onDot(e, world)` receive the world, so an entity can stamp events with `world.time` (the dummy's DPS log does; `dps(world)`).
- Dice: a stub world needs `rng` (use `mkWorld()` from `tests/helpers.mjs`, or `new Rng(seed)`). Script exact values with `withRng(w, seq, fn)` or `dice(seq)`; the roll order is pinned (crit, then spread; ignition, then nullify). `FireballProjectile.roll(world)` and `hitShield(shield, world)` need a world with `rng`. `tests/rng.test.mjs` fails if a gameplay roll goes back to `Math.random`; add a fight step there when you add a new roll.
- Loading: `LoadingScene` runs every task from `loadTasks.buildTasks` and starts the next scene only when all are done and `minTime` has passed; a `fatal` task shows Retry / Back. Add anything the world needs to wait for as a task.
- HUD is DOM (`#ui`): `.hud` is `pointer-events:none`, only the profile circle and status icons take pointer events. The HUD writes to the DOM only when a value changes. Stamina is spent by Dodge only (`Vitals.spendStamina`).
- Scene flow: `menu → home → modes → loading({target}) → world`. Settings and pause return to `home`. Lobby content is data in `lobbyData.js`; art loads only via `lobby/assets.js` (resolve `null` on failure) and `render/drawCover.js`. Modals: `openModal(parent,{title,html})`.
- `drawGround.js` has a local `const n` unrelated to the particle helper. Leave it.

## 10. Next

If the user has no preference, run session rule 10 (ROADMAP "Choosing work"). Plan: `ROADMAP.md` (server path S1-S10 in `SERVER_PATH.md`; lobby path L1-L11; combat depth; world; classes; NPCs/quests; V2.0.0.00 online). Ask the user which fork when starting; one lobby feature per version.
