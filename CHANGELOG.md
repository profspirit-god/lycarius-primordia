# Changelog

Format: `V<MAJOR>.<MINOR>.<FIX>.<CLEANUP>` (see README → Versioning). Newest first.

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
