# Changelog

Format: `V<MAJOR>.<MINOR>.<FIX>.<CLEANUP>` (see README → Versioning). Newest first.

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
