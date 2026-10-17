# Changelog

Format: `V<MAJOR>.<MINOR>.<FIX>.<CLEANUP>` (see README → Versioning). Newest first.

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
