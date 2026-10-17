# Changelog

Format: `V<MAJOR>.<MINOR>.<FIX>.<CLEANUP>` (see README → Versioning). Newest first.

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
